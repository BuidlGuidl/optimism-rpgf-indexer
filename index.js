import axios from "axios";
import {
  createPublicClient,
  http,
  decodeAbiParameters,
  decodeFunctionData,
  keccak256,
} from "viem";
import { optimism } from "viem/chains";
import { ABI } from "./abi.js";
import fs from "fs";
import chalk from "chalk";
import dotenv from "dotenv";

dotenv.config();

try {
  fs.mkdirSync("./cache");
} catch (e) {
  //console.log(e);
}

//lets use .env file
export const publicClient = createPublicClient({
  chain: optimism,
  transport: http(process.env.ETH_RPC_URL),
});

async function fetchData(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    return { error };
  }
}

async function getAllEvents() {
  const address = "0x4200000000000000000000000000000000000021";
  const block = await publicClient.getBlockNumber();
  console.log("📦 current block :: ", block);

  for (let b = block; b > 109427853n; b -= 5000n) {
    console.log("⚙️ processing block range :: ", b - 5001n, b);
    const logs = await publicClient.getContractEvents({
      address,
      abi: ABI,
      eventName: "Attest",
      fromBlock: b - 5001n,
      toBlock: b,
    });

    console.log("📜 found logs :: ", logs.length);
    for (let i = 0; i < logs.length; i++) {
      let name;
      let url;
      let projectData;
      try {
        const transaction = await publicClient.getTransaction({
          hash: logs[i].transactionHash,
        });
        //console.log("transaction", transaction);
        const decoded = decodeFunctionData({
          abi: ABI,
          data: transaction.input,
        });
        //console.log("decoded", decoded);
        const codedData = decoded?.args[0]?.data?.data;
        if (!codedData) {
          continue;
        }
        //console.log("codedData", codedData);
        const decodedParams = decodeAbiParameters(
          [
            { name: "name", type: "string" },
            { name: "num", type: "uint256" },
            { name: "url", type: "string" },
          ],
          codedData
        );
        //console.log("decodedParams", decodedParams);

        name = decodedParams[0];
        url = decodedParams[2];
        //console.log("NAME, URL", name, url);
      } catch (e) {
        //console.log(e);
      }

      if (name && url) {
        if (!url.includes("https://content.optimism.io")) {
          console.log("☢️ ☢️ ☢️ found a non-optimism url", url);
          //process.exit(0);
        } else {
          //console.log("found:", name);

          //hash of url for cache id

          const cacheid = keccak256(url);

          try {
            const readFromCache = fs.readFileSync(
              "./cache/" + cacheid + ".json"
            );
            projectData = JSON.parse(readFromCache);
            /*console.log(
              " 🫡 loaded from cache ",
              projectData?.name || "error file"
            );*/
          } catch (e) {
            //console.log(e);
            console.log("📁 no cache for " + cacheid);
          }

          if (!projectData) {
            console.log("🛰 trying to load metadata for", cacheid, url);
            //get data for this recipient and cache it to a file
            try {
              const data = await fetchData(url);
              if (data.error) {
                console.error(`Error fetching data...`);
                process.exit();
                /*fs.writeFileSync(
                  "./cache/" + cacheid + ".json",
                  JSON.stringify({ error: data.error })
                );*/
              } else {
                console.log("💾 saving data for " + cacheid);

                projectData = { name, url, ...data };
                fs.writeFileSync(
                  "./cache/" + cacheid + ".json",
                  JSON.stringify(projectData)
                );
              }
              // console.log(
              //   "⏳ hardcoded sleep",
              //   await new Promise((r) => setTimeout(r, 100))
              // );
            } catch (e) {
              //console.log(e);
            }
          }

          if (projectData.url.includes("https://content.optimism.io/profile")) {
            console.log("🙋‍♂️ profile for " + chalk.blue(projectData.name));
          } else if (
            projectData.url.includes(
              "https://content.optimism.io/rpgf3Application"
            )
          ) {
            console.log("📋 application for " + chalk.green(projectData.name));
          } else {
            console.log("UNKNOWN " + projectData);
            process.exit(0);
          }
        }
      }
    }
  }
}

getAllEvents();

//fetchData();

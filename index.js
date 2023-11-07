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

// Schemas
const applicationSchema =
  "0x76e98cce95f3ba992c2ee25cef25f756495147608a3da3aa2e5ca43109fe77cc";
const profileSchema =
  "0xac4c92fc5c7babed88f78a917cdbcdc1c496a8f4ab2d5b2ec29402736b2cf929";
const approvalSchema =
  "0xebbf697d5d3ca4b53579917ffc3597fb8d1a85b8c6ca10ec10039709903b9277";

// OP Approval Address
const opAddress = "0x621477dBA416E12df7FF0d48E14c4D20DC85D7D9";

try {
  fs.mkdirSync("./cache");
} catch (e) {
  //console.log(e);
}

try {
  fs.mkdirSync("./approvalCache");
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
      // Filter down to these specific schemas - Application Schema, Profile Schema, Approval Schema
      // topics: [applicationSchema, profileSchema, approvalSchema], // This doesn't filter like I thought it would... :/
    });

    console.log("📜 found logs :: ", logs.length);
    for (const log of logs) {
      let name;
      let url;
      let projectData;
      if ([applicationSchema, profileSchema].includes(log.args.schema)) {
        try {
          const transaction = await publicClient.getTransaction({
            hash: log.transactionHash,
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
          // Application and Profile
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
          console.log(e);
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
                  const { schema, uid } = log.args;
                  projectData = { name, url, ...data, schema, uid };
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

            if (
              projectData.url.includes("https://content.optimism.io/profile")
            ) {
              console.log("🙋‍♂️ profile for " + chalk.blue(projectData.name));
            } else if (
              projectData.url.includes(
                "https://content.optimism.io/rpgf3Application"
              )
            ) {
              console.log(
                "📋 application for " + chalk.green(projectData.name)
              );
            } else {
              console.log("UNKNOWN " + projectData);
              process.exit(0);
            }
          }
        }
      } else if (log.args.schema == approvalSchema) {
        try {
          // Store the approval for use when reading from cache
          console.log("Checking approval event...");
          const { attester, uid } = log.args;
          if (attester == opAddress) {
            const approvedData = await publicClient.readContract({
              address,
              abi: ABI,
              functionName: "getAttestation",
              args: [uid],
            });
            const { refUID, recipient, data, revocationTime } = approvedData;
            const decodedParams = decodeAbiParameters(
              [{ name: "boolApproved", type: "bool" }],
              data
            );
            try {
              const readFromCache = fs.readFileSync(
                "./approvalCache/" + refUID + ".json"
              );
              if (readFromCache) {
                // We already have the most recent data for this approval, skip saving
                continue;
              }
            } catch (e) {
              console.log("Saving approval status for application...");
            }
            // Verify that refUID exists and that this hasn't been revoked
            if (refUID && revocationTime == 0n) {
              const dataToSave = {
                attester,
                uid,
                refUID,
                recipient,
                approved: decodedParams[0],
              };
              fs.writeFileSync(
                "./approvalCache/" + refUID + ".json",
                JSON.stringify(dataToSave)
              );
            }
          }
        } catch (e) {
          console.error("Error while parsing approval", e);
        }
      }
    }
  }
}

getAllEvents();

//fetchData();

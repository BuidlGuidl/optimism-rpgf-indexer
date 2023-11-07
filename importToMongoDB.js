import fs from "fs";
import chalk from "chalk";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME;

const mongoUrl = `${mongoUri}/${dbName}`;
const collectionName = 'projects';
//read all files in dir cache and load them into an object based on the name
async function importData() {
  // Connect to MongoDB
  const client = await MongoClient.connect(mongoUrl);

  const db = client.db(dbName);
  const collection = db.collection(collectionName);
  
  const cacheFiles = fs.readdirSync("./cache");

  const allData = {};
  
  for (let c = 0; c < cacheFiles.length; c++) {
    //console.log(cacheFiles[c]);
    const fileContents = fs.readFileSync("./cache/" + cacheFiles[c]);
    const obj = JSON.parse(fileContents);
  
    if (!allData[obj.name]) {
      allData[obj.name] = {};
    }
    if (obj.url.includes("https://content.optimism.io/profile")) {
      if (allData[obj.name].profile) {
        console.log(chalk.bgRed(chalk.black("DUPLICATE PROFILE")), obj.name);
      } else {
        allData[obj.name].profile = obj;
      }
    } else if (obj.url.includes("https://content.optimism.io/rpgf3Application")) {
      if (allData[obj.name].application) {
        console.log(chalk.bgRed(chalk.black("DUPLICATE APPLICATION")), obj.name);
        // keep the one with more impact metrics
        if (
          allData[obj.name].application.impactMetrics.length <
          obj.impactMetrics.length
        ) {
          allData[obj.name].application = obj;
        }
      } else {
        allData[obj.name].application = obj;
      }
    } else {
      console.log(chalk.bgRed(chalk.black("UNKNOWN TYPE")), obj.name);
    }
  }
  
  console.log("💿 loaded all cached files: ", Object.keys(allData).length);
  
  let count = 0;
  for (let name in allData) {
    const data = allData[name];
    const {profile, application} = data;
    let approved = false;
      try {
        const readFromCache = fs.readFileSync(
          "./approvalCache/" + application.uid + ".json"
        );
        const data = JSON.parse(readFromCache);
        approved = data.approved
      } catch (e) {
        // console.log("Skipping application as no approval was found");
      }

      try {
        const readFromCache = fs.readFileSync(
          "./approvalCache/" + profile.uid + ".json"
        );
        const data = JSON.parse(readFromCache);
        approved = approved || data.approved
      } catch (e) {
        // console.log("Skipping application as no approval was found");
      }
    if ((profile || application) && approved) {
      //full profile
      console.log(
        chalk.bgGreen(chalk.black(name)),
        profile ? chalk.gray(profile.bio) : "",
        application.applicantType
      );
      count++;
  
      // **********************************
      // ADD TO A DATABASE OR SOMETHING HERE
      // data.profile is their profile with name, bio, etc
      // data.application is their application with website and impact metrics, etc
      // **********************************
        console.log("Application has been approved, adding to database");
        // Convert to model and insert
        // const project = Object.assign({}, profile, application);
        // project.ownerName = profile.name;
        // collection.insertOne(project);
      
      
      // **********************************
  
      // **********************************
    } else {
      // submission is missing data - either no profile or no application or not approved
      console.log("skipping application due to incomplete data or lack of approval...");
    }
  }
  
  console.log("\n✅ total full profiles: ", count);
}

importData().then().catch(e => console.error(e));

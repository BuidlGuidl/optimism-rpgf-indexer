import fs from "fs";
import chalk from "chalk";

//read all files in dir cache and load them into an object based on the name

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
  if (data.profile && data.application) {
    //full profile
    console.log(
      chalk.bgGreen(chalk.black(name)),
      chalk.gray(data.profile.bio),
      data.application.applicantType
    );
    count++;

    // **********************************
    // ADD TO A DATABASE OR SOMETHING HERE
    // data.profile is their profile with name, bio, etc
    // data.application is their application with website and impact metrics, etc
    // **********************************

    // **********************************

    // **********************************
  } else {
    // submission is missing data - either no profile or no application
  }
}

console.log("\n✅ total full profiles: ", count);

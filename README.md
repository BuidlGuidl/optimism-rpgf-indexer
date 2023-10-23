# optimism-rpgf-indexer

## install

  you need to setup a .env file with ETH_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOURKEY

## index.js 
  
  this will read events from the contract 0x4200000000000000000000000000000000000021 on optimism 

  (processing in batches of 5000 blocks) 

  it will decode the attestation transaction to find the name and url 

  it downloads the url to /cache/ 

## read.js 

  when index.js is finished you can run this to parse your cache and add data to a database 

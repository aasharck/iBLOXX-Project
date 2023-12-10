# NFT Marketplace

I have created and deployed 3 contracts:
  1. NFT Marketplace - 0x412325Ede58c89757b78738b3100b8BB39B9ADd1
  2. NFT Contract - 0x99461E10dcd205182830F114CA82bfd5d370aF2d
  3. WETH Contract - 0x2100e8dA5B882606a44418E0c1B0c384D0aE351d (Deployed my own WETH Contract to avoid using any faucets)


## Testing

1. Install Dependencies using `npm install` if not already done.

2. `npx hardhat test` - to run the tests

## Deployment

1. Install all dependencies with `npm install`

2. Rename .env.example file to .env and give appropriate values

3. To deploy - `npx hardhat run scripts/deploy.js --network goerli`

### Function execution

1. Go the backend folder - `cd backend`

2. Execute `npm install`

3. Rename .env.example file to .env and give appropriate values

4. I have written functions for all the the smart contract functions. They are:-
  ### **mintNft**
   To mint some nfts to any wallet for testing. 

  #### Usage:
  ```node index.js mintNft [toAddress]```

  `toAddress` - The address to which you want to mint the nft

  tokenIds are minted from 0.

  ### **mintWETH**
   To mint some WETH to any wallet. 

  #### Usage:
  ```node index.js mintWETH [toAddress] [amount]```

  `toAddress` - The address to which you want to the nft

  `amount` - the amount to mint

  ### **listFixedPriceNFT**
   To list an NFT with fixed price

  #### Usage:
  ```node index.js listFixedPriceNFT [wallet] [tokenId] [price]```

  `wallet` - values should be 1 or 2. 1 to use the first wallet and 2 to use the second wallet.
  
  `tokenId` - the tokenId to list

  `price` - the price in wei

### **listNftForAuction**
   To list an NFT on auction

#### Usage:
  ```node index.js listNftForAuction [wallet] [tokenId] [minPrice] [reservePrice] [timePeriod]```

  `wallet` - values should be 1 or 2. 1 to use the first wallet and 2 to use the second wallet.
  
  `tokenId` - the tokenId to list

  `minPrice` - the starting price of auction

  `reservePrice` - The least price the seller is willing to accept

  `timePeriod` - The time period in timestamp value. for egs: 5 days will be 432000

  ### **buyNft**
   To buy an NFT that's listed with a fixed price

  #### Usage:
  ```node index.js buyNft [wallet] [listingId] [price]```

  `wallet` - values should be 1 or 2. 1 to use the first wallet and 2 to use the second wallet.
  
  `listingId` - the id of the listing

  `price` - the price in wei


  ### **bid**
   To bid for an NFT that's placed on Auction

  #### Usage:
  ```node index.js bid [wallet] [listingId] [bidPrice]```

  `wallet` - values should be 1, 2 or 3. 1 to use the first wallet1 and 2 to use the wallet2 and 3 will use wallet3.
  
  `listingId` - the id of the listing

  `bidPrice` - the bid price in wei

  ### **endAuction**
   To complete the transaction after auction expiry

  #### Usage:
  ```node index.js endAuction [wallet] [listingId]```

  `wallet` - values should be 1 or 2. 1 to use the first wallet and 2 to use the second wallet.
  
  `listingId` - the id of the listing

  ### **getFixedPriceNfts**
   To get all NFTs that has a fixed price

  #### Usage:
  ```node index.js getFixedPriceNfts```

  ### **getAuctionedNfts**
   To get all NFTs that are placed for auction

  #### Usage:
  ```node index.js getAuctionedNfts```

  ### **getAuctionEndTime**
   To get the auction expiry of a particular NFT

  #### Usage:
  ```node index.js getAuctionEndTime [nftAddress] [tokenId]```

  `nftAddress` - address of the nft.
  
  `tokenId` - tokenId of the nft

### **getBidders**
   To get all the bidders of a particular NFT

  #### Usage:
  ```node index.js getBidders [nftAddress] [tokenId]```

  `nftAddress` - address of the nft.
  
  `tokenId` - tokenId of the nft

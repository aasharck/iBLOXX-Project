require('dotenv').config()
const ethers = require('ethers')
const marketplaceAbi = require('./ABI/Marketplace.json')
const wethAbi = require('./ABI/WrappedEther.json')
const nftAbi = require('./ABI/MyNFT.json')

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);

// Minter or Owner Wallet
const wallet1 = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const wallet2 = new ethers.Wallet(process.env.PRIVATE_KEY2, provider);
const wallet3 = new ethers.Wallet(process.env.PRIVATE_KEY3, provider);

// If new contracts were deployed, please change the below addresses
const marketplaceAddress = '0x412325Ede58c89757b78738b3100b8BB39B9ADd1';
const wethAddress = '0x2100e8dA5B882606a44418E0c1B0c384D0aE351d';
const nftAddress = '0x99461E10dcd205182830F114CA82bfd5d370aF2d';

const marketplaceContract = new ethers.Contract(marketplaceAddress, marketplaceAbi.abi, provider);
const wethContract = new ethers.Contract(wethAddress, wethAbi.abi, provider);
const nftContract = new ethers.Contract(nftAddress, nftAbi.abi, provider);

async function mintNft(to){
  try {
    const tx = await nftContract.connect(wallet1).safeMint(to)
    await tx.wait();
    console.log("NFT Minted Successfully")
  } catch (error) {
    console.log(error)
  }
}

async function mintWETH(to, amount){
  try {
    const tx = await wethContract.connect(wallet1).mint(to, amount);
    await tx.wait();
    console.log(`${amount} funded to account - ${to}`)
  } catch (error) {
    console.log(error)
  }
}

async function listFixedPriceNFT(wallet, tokenId, price) {
  try {
    const approvalTx = await nftContract.connect(wallet).approve(marketplaceAddress, tokenId)
    await approvalTx.wait();
    const tx = await marketplaceContract.connect(wallet).listNft(nftAddress, tokenId, price, false, 0, 0, 0);
    const receipt = await tx.wait();
    console.log('NFT listed for sale');
  } catch (error) {
    console.log(error);
  }
}

async function listNftForAuction(wallet, tokenId, minPrice, reservePrice, timePeriod){
  try {
    const approvalTx = await nftContract.connect(wallet).approve(marketplaceAddress, tokenId)
    await approvalTx.wait();
    const tx = await marketplaceContract.connect(wallet).listNft(nftAddress, tokenId, 0, true, minPrice, reservePrice, timePeriod);
    await tx.wait();
    console.log("NFT listed for auction")
  } catch (error) {
    console.log(error)
  }
}

async function buyNft(wallet, listingId, price){
  try {
    const tx = await marketplaceContract.connect(wallet).buyFixedPriceNft(listingId, {value: price})
    await tx.wait();
    console.log("NFT successfully bought!")
  } catch (error) {
    console.log(error)
  }
}

async function bid(wallet, listingId, bidPrice){
  try {
    const approvalTx = await wethContract.connect(wallet).approve(marketplaceAddress, bidPrice);
    await approvalTx.wait();
    const tx = await marketplaceContract.connect(wallet).bid(listingId, bidPrice)
    await tx.wait();
    console.log("Bid successfully placed")
  } catch (error) {
    console.log(error)
  }
}

async function endAuction(wallet, listingId){
  try {
    const tx = await marketplaceContract.connect(wallet).endAuction(listingId);
    await tx.wait();
    console.log("Auction ended")
  } catch (error) {
    console.log(error)
  }
}

async function getFixedPriceNfts(){
  try {
    const tx = await marketplaceContract.getFixedPriceNfts();
    console.log(tx);
  } catch (error) {
    console.log(error)
  }
}

async function getAuctionedNfts(){
  try {
    const tx = await marketplaceContract.getAuctionedNfts();
    console.log(tx);
  } catch (error) {
    console.log(error)
  }
}

async function getAuctionEndTime(nftAddress, nftTokenId){
  try {
    const tx = await marketplaceContract.getAuctionEndTime(nftAddress, nftTokenId);
    console.log(tx);
  } catch (error) {
    console.log(error)
  }
}

async function getBidders(nftAddress, nftTokenId){
  try {
    const tx = await marketplaceContract.getBidders(nftAddress, nftTokenId);
    console.log(tx);
  } catch (error) {
    console.log(error)
  }
}

const command = process.argv[2];

switch (command) {
    case 'mintNft':
        const to = process.argv[3];
        mintNft(to);
        break;
    case 'mintWETH':
        const toAddress = process.argv[3];
        const wethAmount = process.argv[4];
        mintWETH(toAddress, wethAmount);
        break;
    case 'listFixedPriceNFT':
        const wallet = process.argv[3] == 1 ? wallet2 : wallet3;
        const tokenId = process.argv[4];
        const price = process.argv[5];
        listFixedPriceNFT(wallet, tokenId, price);
        break;
    case 'listNftForAuction':
        const user = process.argv[3] == 1 ? wallet2 : wallet3;
        const nftTokenId = process.argv[4];
        const minPrice = process.argv[5];
        const reservePrice = process.argv[6];
        const timePeriod = process.argv[7];
        listNftForAuction(user, nftTokenId, minPrice, reservePrice, timePeriod);
        break;
    case 'buyNft':
        const account = process.argv[3] == 1 ? wallet2 : wallet3;
        const listingId = process.argv[4];
        const nftPrice = process.argv[5];
        buyNft(account, listingId, nftPrice);
        break;
    case 'bid':
        let bidWallet;
        if(process.argv[3] == 1){
          bidWallet = wallet1;
        }else if(process.argv[3] == 1){
          bidWallet = wallet2;
        }else{
          bidWallet = wallet3;
        }
        const walletAccount = bidWallet;
        const lId = process.argv[4];
        const bidPrice = process.argv[5];
        bid(walletAccount, lId, bidPrice);
        break;
    case 'endAuction':
        const acc = process.argv[3] == 1 ? wallet2 : wallet3;
        const listId = process.argv[4];
        endAuction(acc, listId);
        break;
    case 'getFixedPriceNfts':
        getFixedPriceNfts();
        break;
    case 'getAuctionedNfts':
        getAuctionedNfts();
        break;
    case 'getAuctionEndTime':
        const nftAddr = process.argv[3];
        const nftTokId = process.argv[4];
        getAuctionEndTime(nftAddr, nftTokId);
        break;
    case 'getBidders':
        const nftAdd = process.argv[3];
        const nftId = process.argv[4];
        getBidders(nftAdd, nftId);
        break;
    default:
        console.log('Invalid command');
        break;
}
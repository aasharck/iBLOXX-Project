const { expect } = require("chai");
const { ethers, upgrades } = require('hardhat')

describe("NFT Marketplace", function () {
  let owner, seller1, seller2, seller3, buyer1, buyer2, marketplace, nftContract, wethContract;
  const someAddress = "0xFbB28e9380B6657b4134329B47D9588aCfb8E33B"
  
  beforeEach( async () => {
    // Contracts are deployed using the first signer/account by default
    [owner, seller1, seller2, seller3, buyer1, buyer2 ] = await ethers.getSigners();

    const WETHContract = await ethers.getContractFactory("WrappedEther");
    wethContract = await upgrades.deployProxy(WETHContract, [owner.address],{
      initializer: "initialize",
    });
    await wethContract.waitForDeployment();
    
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await upgrades.deployProxy(Marketplace, [owner.address, wethContract.target],{
      initializer: "initialize",
    });
    
    await marketplace.waitForDeployment();

    const NFTContract = await ethers.getContractFactory("MyNFT");
    nftContract = await upgrades.deployProxy(NFTContract, [owner.address],{
      initializer: "initialize",
    });
    await nftContract.waitForDeployment();
  
    await wethContract.connect(owner).mint(buyer1.address, ethers.parseEther("100"));
    await wethContract.connect(owner).mint(buyer2.address, ethers.parseEther("100"));
    await nftContract.connect(owner).safeMint(seller1.address);
    await nftContract.connect(owner).safeMint(seller2.address);
    await nftContract.connect(owner).safeMint(seller3.address);
  })

  describe("Deployment", function () {
    it("Should grant DEFAULT_ADMIN_ROLE to owner of contract", async () => {
      const hasAdminRole = await marketplace.hasRole(await marketplace.DEFAULT_ADMIN_ROLE(), owner.address);
      expect(hasAdminRole).to.eq(true);
    });

    it("Should grant MINTER_ROLE to owner of contract and another address", async () => {
      const hasMinterRole = await nftContract.hasRole(await nftContract.MINTER_ROLE(), owner.address);
      const hasMinterRole2 = await nftContract.hasRole(await nftContract.MINTER_ROLE(), someAddress);
      expect(hasMinterRole).to.eq(true);
      expect(hasMinterRole2).to.eq(true);
    });

    it("Cannot initialize again", async () => {
      await expect(marketplace.connect(buyer1).initialize(buyer1.address, wethContract.target)).to.be.revertedWithCustomError(marketplace, 'InvalidInitialization')
    })

  });

  describe("Fixed Price NFT", async () => {
    it("Should be able to list a Fixed Price NFT", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      const listTx = await marketplace.connect(seller1).listNft(nftContract.target, 0, ethers.parseEther("0.01"), false, 0, 0 ,0);
      expect(listTx).to.emit(marketplace, "NftListed")
      const listing1 = await marketplace.listings(0);
      expect(listing1.nftOwner).to.eq(seller1.address);
      expect(await nftContract.connect(seller1).getApproved(0)).to.eq(marketplace.target);
    })

    it("Should be able to buy a fixed price NFT", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, ethers.parseEther("0.01"), false, 0, 0 ,0);
      expect(await nftContract.balanceOf(buyer1.address)).to.eq(0);
      
      const buyTx = await marketplace.connect(buyer1).buyFixedPriceNft(0, {value: ethers.parseEther("0.01")});
      expect(buyTx).to.emit(marketplace, "NftPurchased")
      const listing1 = await marketplace.listings(0);
      expect(listing1.soldTo).to.eq(buyer1.address)
      expect(await nftContract.balanceOf(buyer1.address)).to.eq(1);
    })

    it("Cannot list the same NFT Twice", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, ethers.parseEther("0.01"), false, 0, 0 ,0);
      await expect(marketplace.connect(seller1).listNft(nftContract.target, 0, ethers.parseEther("0.01"), false, 0, 0 ,0)).to.be.revertedWith("Cannot list the same nft twice");
    })

    it("Should approve nft", async () => {
      await expect(marketplace.connect(seller1).listNft(nftContract.target, 0, ethers.parseEther("0.01"), false, 0, 0 ,0)).to.be.revertedWith("Token Id not approved to the marketplace");
    })

    it("Cannot list another person's nft", async () => {
      await expect(marketplace.connect(seller1).listNft(nftContract.target, 1, ethers.parseEther("0.01"), false, 0, 0 ,0)).to.be.revertedWith("You do not own this NFT");
    })

    it("Cannot set price to 0", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await expect(marketplace.connect(seller1).listNft(nftContract.target, 0, 0, false, 0, 0 ,0)).to.be.revertedWith("price should be greater than 0");
    })

    it("Cannot buy twice", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, ethers.parseEther("0.01"), false, 0, 0 ,0);
      
      await marketplace.connect(buyer1).buyFixedPriceNft(0, {value: ethers.parseEther("0.01")});
      await expect(marketplace.connect(buyer2).buyFixedPriceNft(0, {value: ethers.parseEther("0.01")})).to.be.revertedWith("This listing is not active or already sold");
    })

    it("Can be listed again after buying from another seller", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, ethers.parseEther("0.01"), false, 0, 0 ,0);
      
      await marketplace.connect(buyer1).buyFixedPriceNft(0, {value: ethers.parseEther("0.01")});
      
      await nftContract.connect(buyer1).approve(marketplace.target, 0);
      await marketplace.connect(buyer1).listNft(nftContract.target, 0, ethers.parseEther("0.5"), false, 0, 0 ,0);
      
      const listing = await marketplace.listings(1);
      expect(await listing.nftOwner).to.eq(buyer1.address);
      expect(await listing.price).to.eq(ethers.parseEther("0.5"))
    })
  })

  describe("Auctioned NFTs", () => {
    it("Auction an NFT", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      const listTx = await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("0.15"), ethers.parseEther("1"), 432000);
      expect(listTx).to.emit(marketplace, "NftListed");

      const listing1 = await marketplace.listings(0);
      expect(listing1.nftOwner).to.eq(seller1.address);
      expect(listing1.reservePrice).to.eq(ethers.parseEther("1"));
    })

    it("Auction and Bid", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("0.15"), ethers.parseEther("1"), 432000);
    
      await wethContract.connect(buyer1).approve(marketplace.target, ethers.parseEther("100"))
      const bidTx = await marketplace.connect(buyer1).bid(0, ethers.parseEther("0.5"));
      expect(bidTx).to.emit(marketplace, "BidPlaced");
      
      const listing1 = await marketplace.listings(0);
      expect(listing1.highestBid).to.eq(ethers.parseEther("0.5"))
      expect(listing1.highestBidder).to.eq(buyer1.address);
    })

    it("2 bids", async () =>{
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("0.25"), ethers.parseEther("1"), 432000);
    
      await wethContract.connect(buyer1).approve(marketplace.target, ethers.parseEther("100"))
      await marketplace.connect(buyer1).bid(0, ethers.parseEther("0.5"));

      await wethContract.connect(buyer2).approve(marketplace.target, ethers.parseEther("100"))
      await marketplace.connect(buyer2).bid(0, ethers.parseEther("0.75"));
    
      const listing1 = await marketplace.listings(0);
      const allBidders = await marketplace.getBidders(listing1.nftAddress, listing1.tokenId);
      expect(allBidders.length).to.eq(2)
      expect(listing1.highestBid).to.eq(ethers.parseEther("0.75"))
      expect(listing1.highestBidder).to.eq(buyer2.address);
    })

    it("Auction, Bid and end", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("0.15"), ethers.parseEther("1"), 432000);
    
      await wethContract.connect(buyer1).approve(marketplace.target, ethers.parseEther("100"))
      await marketplace.connect(buyer1).bid(0, ethers.parseEther("1.5"));
      expect(await nftContract.balanceOf(buyer1.address)).to.eq(0);
    
      await network.provider.send("evm_increaseTime", [432001])
      const tx = await marketplace.endAuction(0);
      expect(tx).to.emit(marketplace, "NftPurchased");

      const listing1 = await marketplace.listings(0);
      const allBidders = await marketplace.getBidders(listing1.nftAddress, listing1.tokenId);
      expect(allBidders.length).to.eq(0)
      expect(listing1.soldTo).to.eq(buyer1.address)
      expect(await nftContract.balanceOf(buyer1.address)).to.eq(1);
    })

    it("Cannot end auction before expiry timestamp", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("0.15"), ethers.parseEther("2"), 432000);
      
      await wethContract.connect(buyer1).approve(marketplace.target, ethers.parseEther("1.5"))
      await marketplace.connect(buyer1).bid(0, ethers.parseEther("1.5"));
    
      await network.provider.send("evm_increaseTime", [12000])
      await expect(marketplace.endAuction(0)).to.be.revertedWith("Auction is NOT Over!");
    })

    it("Cannot Bid lower than the previous bidder", async() => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("0.25"), ethers.parseEther("1"), 432000);
    
      await wethContract.connect(buyer1).approve(marketplace.target, ethers.parseEther("0.5"))
      await marketplace.connect(buyer1).bid(0, ethers.parseEther("0.5"));

      await wethContract.connect(buyer2).approve(marketplace.target, ethers.parseEther("0.15"))
      await expect(marketplace.connect(buyer2).bid(0, ethers.parseEther("0.35"))).to.be.revertedWith("Bid is lower than the current highest Bid");
    })

    it("Bidder should have enough WETH", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("100"), ethers.parseEther("200"), 432000);
    
      await wethContract.connect(buyer1).approve(marketplace.target, ethers.parseEther("105"))
      await expect(marketplace.connect(buyer1).bid(0, ethers.parseEther("105"))).to.be.revertedWith("You do not have enough WETH to bid");
    })

    it("Bidder should give allowance to the marketplace", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("0.25"), ethers.parseEther("1"), 432000);
    
      await expect(marketplace.connect(buyer1).bid(0, ethers.parseEther("0.5"))).to.be.revertedWith("No approval given for marketplace");

    })

    it("Can relist NFT back to the marketplace after an auction", async() => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("0.15"), ethers.parseEther("1"), 432000);
    
      await wethContract.connect(buyer1).approve(marketplace.target, ethers.parseEther("100"))
      await marketplace.connect(buyer1).bid(0, ethers.parseEther("1.5"));
      expect(await nftContract.balanceOf(buyer1.address)).to.eq(0);
    
      await network.provider.send("evm_increaseTime", [432001])
      await marketplace.endAuction(0);

      expect(await nftContract.balanceOf(buyer1.address)).to.eq(1);
      await nftContract.connect(buyer1).approve(marketplace.target, 0);
      await marketplace.connect(buyer1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("4"), ethers.parseEther("10"), 432000);
     
      const listing1 = await marketplace.listings(1);
      expect(await listing1.nftOwner).to.eq(buyer1.address);
      expect(await listing1.minPrice).to.eq(ethers.parseEther("4"))
    })
  })

  describe.only("Get Functions", () => {
    it("Get all Fixed Price NFTs", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, ethers.parseEther("0.01"), false, 0, 0 ,0);

      await nftContract.connect(seller3).approve(marketplace.target, 2);
      await marketplace.connect(seller3).listNft(nftContract.target, 2, 0, true, ethers.parseEther("0.15"), ethers.parseEther("5") ,20000);
      
      await nftContract.connect(seller2).approve(marketplace.target, 1);
      await marketplace.connect(seller2).listNft(nftContract.target, 1, ethers.parseEther("0.15"), false, 0, 0 ,0);
      
      const fixedListOfNfts = await marketplace.getFixedPriceNfts();
      expect(fixedListOfNfts[0].nftOwner).to.eq(seller1.address);
      expect(fixedListOfNfts[1].nftOwner).to.eq(seller2.address);
      expect(fixedListOfNfts[0].isAuction).to.eq(false);
      expect(fixedListOfNfts[1].isAuction).to.eq(false);
    })

    it("Get all Auctioned NFTs", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, ethers.parseEther("0.01"), false, 0, 0 ,0);

      await nftContract.connect(seller3).approve(marketplace.target, 2);
      await marketplace.connect(seller3).listNft(nftContract.target, 2, 0, true, ethers.parseEther("0.15"), ethers.parseEther("5") ,20000);
      
      await nftContract.connect(seller2).approve(marketplace.target, 1);
      await marketplace.connect(seller2).listNft(nftContract.target, 1, ethers.parseEther("0.15"), false, 0, 0 ,0);
      
      const auctionedNfts = await marketplace.getAuctionedNfts();
      expect(auctionedNfts[0].nftOwner).to.eq(seller3.address);
      expect(auctionedNfts[0].isAuction).to.eq(true);
    })

    it("Get Auction End Time", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("0.65"), ethers.parseEther("2") ,299900);

      const listing1 = await marketplace.listings(0);
      const endTime = await marketplace.getAuctionEndTime(listing1.nftAddress, listing1.tokenId)
      expect(endTime).to.gt(299900);
    })

    it("Get all Bidders for a particular auction", async () => {
      await nftContract.connect(seller1).approve(marketplace.target, 0);
      await marketplace.connect(seller1).listNft(nftContract.target, 0, 0, true, ethers.parseEther("0.25"), ethers.parseEther("1"), 432000);
    
      await wethContract.connect(buyer1).approve(marketplace.target, ethers.parseEther("100"))
      await marketplace.connect(buyer1).bid(0, ethers.parseEther("0.5"));

      await wethContract.connect(buyer2).approve(marketplace.target, ethers.parseEther("100"))
      await marketplace.connect(buyer2).bid(0, ethers.parseEther("0.75"));
    
      const listing1 = await marketplace.listings(0);
      const bidders = await marketplace.getBidders(listing1.nftAddress, listing1.tokenId)
      expect(bidders[1].bidder).to.eq(listing1.highestBidder)
      expect(bidders[0].bidder).to.not.eq(ethers.ZeroAddress)
    })
  })
});

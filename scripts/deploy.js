const { ethers, upgrades } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();

  const WETHContract = await ethers.getContractFactory("WrappedEther");
  let wethContract = await upgrades.deployProxy(WETHContract, [owner.address],{
      initializer: "initialize",
    });
  await wethContract.waitForDeployment();

  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await upgrades.deployProxy(Marketplace, [owner.address, wethContract.target], {
    initializer: "initialize"
  });
  await marketplace.waitForDeployment();

  const SampleNFT = await ethers.getContractFactory("MyNFT");
  const sampleNft = await upgrades.deployProxy(SampleNFT, [owner.address], {
    initializer: "initialize"
  });
  await sampleNft.waitForDeployment();


  console.log(
    `WETH deployed to ${wethContract.target}`
  );
  console.log(
    `Marketplace deployed to ${marketplace.target}`
  );
  console.log(
    `NFT deployed to ${sampleNft.target}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

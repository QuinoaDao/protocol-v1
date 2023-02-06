import { ethers } from "hardhat";
import { Product, UsdPriceModule, Strategy } from "../typechain-types";

const quickSwapFactory = "0x69004509291F4a4021fA169FafdCFc2d92aD02Aa";
const quickSwapRouter = "0xbdd4e5660839a088573191A9889A262c0Efc0983";

const wmaticAddress = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"; // 바꿈
const wethAddress = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa"; // 바꿈
const linkAddress = "0x326C977E6efc84E512bB9C30f76E30c160eD06FB"; // 바꿈
const usdcAddress = "0x0fa8781a83e46826621b3bc094ea2a0212e71b23"; // 바꿈

const wmaticOracle = "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada";
const wethOracle = "0x0715A7794a1dc8e42615F059dD6e406A6594651A";
const linkOracle = "0x12162c3E810393dEC01362aBf156D7ecf6159528"; 
const usdcOracle = "0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0";

async function deployContracts() {
    // Deploy the contract to the test network
    const Product = await ethers.getContractFactory("Product");
    const Strategy = await ethers.getContractFactory("Strategy");
    const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");
    const [dac, nonDac] = await ethers.getSigners();

    const usdPriceModule = await UsdPriceModule.deploy();
    await usdPriceModule.deployed();

    // Product constructor parameter list
    // string memory name_, 
    // string memory symbol_, 
    // address dacAddress_, 
    // string memory dacName_, 
    // address usdPriceModule_,
    // address underlyingAssetAddress_,
    // address[] memory assetAddresses_, 
    // uint256 floatRatio_,
    // uint256 deviationThreshold_,
    // address swapFactory_,
    // address swapRouter_
    const product = await Product.deploy("Quinoa test Product", "qTEST", dac.address, "Quinoa DAC", usdPriceModule.address, usdcAddress, [wmaticAddress, wethAddress, linkAddress], 20000, 5000, quickSwapFactory, quickSwapRouter);
    await product.deployed();

    const wmaticStrategy = await Strategy.deploy(wmaticAddress, product.address);
    await wmaticStrategy.deployed();
    const wethStrategy = await Strategy.deploy(wethAddress, product.address);
    await wethStrategy.deployed();
    const linkStrategy = await Strategy.deploy(linkAddress, product.address);
    await linkStrategy.deployed();
    const usdcStrategy = await Strategy.deploy(usdcAddress, product.address);
    await usdcStrategy.deployed();

    return {
      dac, nonDac, 
      product, 
      wmaticStrategy, wethStrategy, linkStrategy, usdcStrategy, 
      usdPriceModule
    };
}

async function setUsdPriceModule(usdPriceModule: UsdPriceModule) {
    await usdPriceModule.addUsdPriceFeed(wmaticAddress, wmaticOracle);
    await usdPriceModule.addUsdPriceFeed(wethAddress, wethOracle);
    await usdPriceModule.addUsdPriceFeed(linkAddress, linkOracle);
    await usdPriceModule.addUsdPriceFeed(usdcAddress, usdcOracle);
}
  
  async function setProduct(product: Product, linkStrategy: Strategy, wmaticStrategy: Strategy, wethStrategy: Strategy, usdcStrategy: Strategy) {    
    // add strategy 
    await product.addStrategy(linkStrategy.address);
    await product.addStrategy(wmaticStrategy.address);
    await product.addStrategy(wethStrategy.address);
    await product.addStrategy(usdcStrategy.address);

    // update weight 해서 원하는 weight까지 
    await product.updateWeight([wmaticAddress, wethAddress, linkAddress, usdcAddress], [30000, 30000, 10000, 30000]);
  
    // withdrawal queue update
    await product.updateWithdrawalQueue([linkStrategy.address, wmaticStrategy.address, wethStrategy.address, usdcStrategy.address]);
}

async function main(){
    const {dac, nonDac, product, wmaticStrategy, wethStrategy, linkStrategy, usdcStrategy, usdPriceModule} = await deployContracts();
    await setUsdPriceModule(usdPriceModule);
    await setProduct(product, linkStrategy, wmaticStrategy, wethStrategy, usdcStrategy);

    console.log('Product address', product.address);
    console.log('Wmatic Strategy address', wmaticStrategy.address);
    console.log('WETH Strategy address', wethStrategy.address);
    console.log('Link Strategy address', linkStrategy.address);
    console.log('USDC Strategy address', usdcStrategy.address);
    console.log('USD Price Module address', usdPriceModule.address);
    console.log('Dac address', dac.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

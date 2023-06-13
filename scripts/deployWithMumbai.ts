import { ethers } from "hardhat";
import { Product, UsdPriceModule, Strategy, TestUsdc, TestToken } from "../typechain-types";
import { abi as productAbi} from "../artifacts/contracts/Product.sol/Product.json";

const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

// const wmaticAddress = "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889";
// const wethAddress = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa";
// const linkAddress = "0x326C977E6efc84E512bB9C30f76E30c160eD06FB";
// const daiAddress = "0xcB1e72786A6eb3b44C2a2429e317c8a2462CFeb1";
// const usdcAddress = "0xE097d6B3100777DC31B34dC2c58fB524C2e76921"; 

const wmaticOracle = "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada";
const wethOracle = "0x0715A7794a1dc8e42615F059dD6e406A6594651A";
const linkOracle = "0x1C2252aeeD50e0c9B64bDfF2735Ee3C932F5C408"; 
const usdcOracle = "0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0";
const keeperRegistry = "0xE16Df59B887e3Caa439E0b29B42bA2e7976FD8b2";

async function deployContracts() {
    // Using Test tokens
    const TestUsdc = await ethers.getContractFactory("TestUsdc");
    const TestToken = await ethers.getContractFactory("TestToken");

    const testUsdc = await TestUsdc.deploy();
    await testUsdc.deployed();
    const testWmatic = await TestToken.deploy("TestWmatic", "wMATIC");
    await testWmatic.deployed();
    const testWeth = await TestToken.deploy("TestWeth", "wETH");
    await testWeth.deployed();
    const testLink = await TestToken.deploy("TestLink", "LINK");
    await testLink.deployed();

    // Deploy the contract to the test network
    const Product = await ethers.getContractFactory("Product");
    const Strategy = await ethers.getContractFactory("Strategy");
    const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");
    const WhitelistRegistry = await ethers.getContractFactory("WhitelistRegistry");

    const [dac, nonDac] = await ethers.getSigners();

    const whitelistRegistry = await WhitelistRegistry.deploy();
    await whitelistRegistry.deployed();

    const usdPriceModule = await UsdPriceModule.deploy();
    await usdPriceModule.deployed();

    const productInfo = {
        productName: "Quinoa test Product",
        productSymbol: "qTEST",
        dacName: "Quinoa DAC",
        dacAddress: dac.address,
        underlyingAssetAddress: testUsdc.address,
        floatRatio: 20000,
        deviationThreshold: 5000
    }
  
    const product = await Product.deploy(
        productInfo, 
        whitelistRegistry.address, 
        keeperRegistry,
        usdPriceModule.address, 
        [testWmatic.address, testWeth.address, testLink.address], 
        quickSwapFactory, 
        quickSwapRouter);
    await product.deployed();

    const wmaticStrategy = await Strategy.deploy(dac.address, testWmatic.address, product.address);
    await wmaticStrategy.deployed();
    const wethStrategy = await Strategy.deploy(dac.address, testWeth.address, product.address);
    await wethStrategy.deployed();
    const linkStrategy = await Strategy.deploy(dac.address, testLink.address, product.address);
    await linkStrategy.deployed();
    const usdcStrategy = await Strategy.deploy(dac.address, testUsdc.address, product.address);
    await usdcStrategy.deployed();

    await usdPriceModule.addUsdPriceFeed(testWmatic.address, wmaticOracle);
    await usdPriceModule.addUsdPriceFeed(testWeth.address, wethOracle);
    await usdPriceModule.addUsdPriceFeed(testLink.address, linkOracle);
    await usdPriceModule.addUsdPriceFeed(testUsdc.address, usdcOracle);

    return {
      dac, nonDac, 
      testWmatic, testWeth, testLink, testUsdc,
      product, 
      wmaticStrategy, wethStrategy, linkStrategy, usdcStrategy, 
      usdPriceModule
    };
}

  
async function setProduct(
    product: Product, 
    wmaticStrategy: Strategy, 
    wethStrategy: Strategy, 
    linkStrategy: Strategy, 
    usdcStrategy: Strategy,
    wmaticAddress: string,
    wethAddress: string,
    linkAddress: string,
    usdcAddress: string
) {    
    // add strategy 
    await (await product.addStrategy(linkStrategy.address)).wait();
    await (await product.addStrategy(wmaticStrategy.address)).wait();
    await (await product.addStrategy(wethStrategy.address)).wait();
    await (await product.addStrategy(usdcStrategy.address)).wait();

    // update weight 해서 원하는 weight까지 
    await (await product.updateWeight([wmaticAddress, wethAddress, linkAddress, usdcAddress], [30000, 30000, 10000, 30000])).wait();
  
    // withdrawal queue update
    await (await product.updateWithdrawalQueue([linkStrategy.address, wmaticStrategy.address, wethStrategy.address, usdcStrategy.address])).wait();
}

async function main(){
    const {
        dac,
        testWmatic, testWeth, testLink, testUsdc,
        product, 
        wmaticStrategy, 
        wethStrategy, 
        linkStrategy, 
        usdcStrategy, 
        usdPriceModule
    } = await deployContracts();

    await setProduct(
        product,
        wmaticStrategy,
        wethStrategy,
        linkStrategy,
        usdcStrategy,
        testWmatic.address,
        testWeth.address,
        testLink.address,
        testUsdc.address
    );

    console.log('Product address', product.address);
    console.log("*");
    console.log("Test Wmatic address: ", testWmatic.address);
    console.log("Test Weth address: ", testWeth.address);
    console.log("Test Link address: ", testLink.address);
    console.log("Test Usdc address: ", testUsdc.address);
    console.log("*");
    console.log('Wmatic Strategy address', wmaticStrategy.address);
    console.log('WETH Strategy address', wethStrategy.address);
    console.log('Link Strategy address', linkStrategy.address);
    console.log('USDC Strategy address', usdcStrategy.address);
    console.log("*");
    console.log('USD Price Module address', usdPriceModule.address);
    console.log('Dac address', dac.address);

    await (await product.activateProduct()).wait();

    console.log('product status: ', await product.checkActivation());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

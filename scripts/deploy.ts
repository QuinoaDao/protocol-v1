import { ethers } from "hardhat";
import { Product, UsdPriceModule, Strategy} from "../typechain-types";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { abi as productAbi} from "../artifacts/contracts/Product.sol/Product.json";
import { abi as usdPriceModuleAbi} from "../artifacts/contracts/UsdPriceModule.sol/UsdPriceModule.json";
import { abi as strategyAbi} from "../artifacts/contracts/Strategy.sol/Strategy.json";
import usdcAbi from "../abis/usdcABI.json";
import wMaticAbi from "../abis/wMaticABI.json";
import { Wallet } from "ethers";

const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const wethAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const quickAddress = "0x831753DD7087CaC61aB5644b308642cc1c33Dc13";
const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; 

const wmaticOracle = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
const wethOracle = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
const quickOracle = "0xa058689f4bCa95208bba3F265674AE95dED75B6D"; 
const usdcOracle = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";
const keeperRegistry = "0x02777053d6764996e594c3E88AF1D58D5363a2e6";

async function deployContracts() {

    // Deploy the contract to the  network
    const Product = await ethers.getContractFactory("Product");
    const Strategy = await ethers.getContractFactory("Strategy");
    const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");
    const WhitelistRegistry = await ethers.getContractFactory("WhitelistRegistry");

    const [dac, nonDac] = await ethers.getSigners();
    // const dac = await ethers.getImpersonatedSigner("0x93d702002F1232247AD2349e3A98110C8CE4190a");
    // const nonDac = await ethers.getSigners()[0];

    const whitelistRegistry = await WhitelistRegistry.deploy();
    await whitelistRegistry.deployed();
    console.log('whitelistRegistry address', whitelistRegistry.address);
    const usdPriceModule = await UsdPriceModule.deploy();
    await usdPriceModule.deployed();
    console.log('USD Price Module address', usdPriceModule.address);

    console.log(" wmatic address: ", wmaticAddress);
    console.log(" weth address: ", wethAddress);
    console.log(" quick address: ", quickAddress);
    console.log(" usdc address: ", usdcAddress);
    console.log("*");

    console.log("*");

    console.log('Dac address', dac.address);

    const productInfo = {
        productName: "Quinoa Static Asset Allocation",
        productSymbol: "QSAA",
        dacName: "QuinoaDAC",
        dacAddress: dac.address,
        underlyingAssetAddress: usdcAddress,
        floatRatio: 20000,
        deviationThreshold: 5000
    }
  
    const product = await Product.deploy(
        productInfo, 
        whitelistRegistry.address, 
        keeperRegistry,
        usdPriceModule.address, 
        [wmaticAddress, wethAddress, quickAddress], 
        quickSwapFactory, 
        quickSwapRouter);
    await product.deployed();

    console.log('Product address', product.address);
    console.log("*");

    const wmaticStrategy = await Strategy.deploy(dac.address, wmaticAddress, product.address);
    await wmaticStrategy.deployed();
    console.log('wmatic Strategy address', wmaticStrategy.address);

    const wethStrategy = await Strategy.deploy(dac.address, wethAddress, product.address);
    await wethStrategy.deployed();
    console.log('weth Strategy address', wethStrategy.address);
    
    const quickStrategy = await Strategy.deploy(dac.address, quickAddress, product.address);
    await quickStrategy.deployed();
    console.log('quick Strategy address', quickStrategy.address);

    const usdcStrategy = await Strategy.deploy(dac.address, usdcAddress, product.address);
    await usdcStrategy.deployed();
    console.log('usdc Strategy address', usdcStrategy.address);
    console.log(" wmatic address: ", wmaticAddress);
    console.log(" weth address: ", wethAddress);
    console.log(" quick address: ", quickAddress);
    console.log(" usdc address: ", usdcAddress);
    console.log("*");

    console.log("*");
    console.log('USD Price Module address', usdPriceModule.address);
    console.log('Dac address', dac.address);

    return {
      dac, nonDac, 
      product, 
      wmaticStrategy, wethStrategy, quickStrategy, usdcStrategy, 
      usdPriceModule
    };
}

async function addPriceFeed(
        product: Product, 
        usdPriceModule: UsdPriceModule, 
        wmaticOracleAddress: string, 
        wethOracleAddress: string,
        quickOracleAddress: string,
        usdcOracleAddress: string
        ) {
  await(await usdPriceModule.addUsdPriceFeed(wmaticAddress, wmaticOracle)).wait();
  await(await usdPriceModule.addUsdPriceFeed(wethAddress, wethOracle)).wait();
  await(await usdPriceModule.addUsdPriceFeed(quickAddress, quickOracle)).wait();
  await(await usdPriceModule.addUsdPriceFeed(usdcAddress, usdcOracle)).wait();
  console.log('price module set');
}

  
async function setProduct(
    product: Product, 
    wmaticStrategy: Strategy, 
    wethStrategy: Strategy, 
    quickStrategy: Strategy, 
    usdcStrategy: Strategy,
    wmaticAddress: string,
    wethAddress: string,
    quickAddress: string,
    usdcAddress: string
) {    
    // add strategy 
    await (await product.addStrategy(wmaticStrategy.address)).wait();
    await (await product.addStrategy(wethStrategy.address)).wait();
    await (await product.addStrategy(quickStrategy.address)).wait();
    await (await product.addStrategy(usdcStrategy.address)).wait();
    console.log("strategy set")

    // update weight 해서 원하는 weight까지 
    await (await product.updateWeight([wmaticAddress, wethAddress, quickAddress, usdcAddress], [40000, 20000, 10000, 30000])).wait();
    console.log("weight updated");
    // withdrawal queue update
    await (await product.updateWithdrawalQueue([wmaticStrategy.address, wethStrategy.address, quickStrategy.address, usdcStrategy.address])).wait();
    console.log("withdrawalQueue Set");
}

async function main(){
    const {
        dac, nonDac,
        product, 
        wmaticStrategy, 
        wethStrategy, 
        quickStrategy, 
        usdcStrategy, 
        usdPriceModule
    } = await deployContracts();

    await addPriceFeed(product, 
        usdPriceModule, 
        wmaticOracle,
        wethOracle,
        quickOracle,
        usdcOracle
    );

    await setProduct(
        product,
        wmaticStrategy,
        wethStrategy,
        quickStrategy,
        usdcStrategy,
        wmaticAddress,
        wethAddress,
        quickAddress,
        usdcAddress
    );
    const wmaticContract = new ethers.Contract(wmaticAddress, wMaticAbi, dac);
    await (await wmaticContract.connect(dac).deposit({value: parseUnits("147",18)})).wait();
    console.log(await wmaticContract.balanceOf(dac.address));
    await (await wmaticContract.approve(product.address, parseUnits("147", 18))).wait();
    console.log("wmatic Approved");
    await (await product.connect(dac).deposit(wmaticAddress, parseUnits("147", 18), dac.address)).wait();


    // const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, dac);
    // await (await usdcContract.approve(product.address, parseUnits("205", 6))).wait();
    // console.log("USDC Approved");
    // console.log(await usdcContract.balanceOf(dac.address));
    // await (await product.connect(dac).deposit(usdcAddress, parseUnits("205", 6), dac.address)).wait();
    console.log("Deposit");
    await (await product.activateProduct()).wait();

    console.log('product status: ', await product.checkActivation());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

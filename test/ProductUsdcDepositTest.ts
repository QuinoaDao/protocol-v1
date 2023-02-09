import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract, utils } from "ethers";
import { Product, Strategy, UsdPriceModule, ERC20, contracts } from "../typechain-types";

import wMaticAbi from "../abis/wMaticABI.json";
import usdcAbi from "../abis/usdcABI.json";
import wEthAbi from "../abis/wEthABI.json";
import quickAbi from "../abis/quickABI.json";
import ghstAbi from "../abis/ghstABI.json";
import quickSwapAbi from "../abis/quickSwapABI.json";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { days } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const wethAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const ghstAddress = "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7";
const quickAddress = "0xB5C064F955D8e7F38fE0460C556a72987494eE17";
const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

const wmaticOracle = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
const wethOracle = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
const ghstOracle = "0xDD229Ce42f11D8Ee7fFf29bDB71C7b81352e11be";
const quickOracle = "0xa058689f4bCa95208bba3F265674AE95dED75B6D";
const usdcOracle = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";

const uniAddress = "0xb33EaAd8d922B1083446DC23f610c2567fB5180f";
const uniOracle = "0xdf0Fb4e4F928d2dCB76f438575fDD8682386e13C";

async function deployContracts() {
    // Deploy the contract to the test network
    const Product = await ethers.getContractFactory("Product");
    const Strategy = await ethers.getContractFactory("Strategy");
    const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");
  
    const [dac, nonDac] = await ethers.getSigners();
  
    const usdPriceModule = await UsdPriceModule.deploy();
    await usdPriceModule.deployed();
  
    const product = await Product.deploy(
      "Quinoa test Product",
      "qTEST",
      dac.address,
      "Quinoa DAC",
      usdPriceModule.address,
      usdcAddress,
      [wmaticAddress, wethAddress],
      20000,
      5000,
      quickSwapFactory,
      quickSwapRouter
    );
    await product.deployed();
  
    const wmaticStrategy = await Strategy.deploy(wmaticAddress, product.address);
    await wmaticStrategy.deployed();
    const wethStrategy = await Strategy.deploy(wethAddress, product.address);
    await wethStrategy.deployed();
    const ghstStrategy = await Strategy.deploy(ghstAddress, product.address);
    await ghstStrategy.deployed();
    const quickStrategy = await Strategy.deploy(quickAddress, product.address);
    await usdPriceModule.deployed();
    await quickStrategy.deployed();
    const usdcStrategy = await Strategy.deploy(usdcAddress, product.address);
    await usdcStrategy.deployed();
  
    // non dac member depoly bad strategy 1
    const nonDacStrategy = await Strategy.connect(nonDac).deploy(
      wmaticAddress,
      product.address
    );
    await nonDacStrategy.deployed();
    // bad strategy 2 uses uni token that product doesn't use
    const diffAssetStrategy = await Strategy.deploy(uniAddress, product.address);
    await diffAssetStrategy.deployed();
    // bad strategy 3 is duplicated strategy with wmaticStrategy
    const dupStrategy = await Strategy.deploy(wmaticAddress, product.address);
    await dupStrategy.deployed();
  
    return {
      dac,
      nonDac,
      product,
      wmaticStrategy,
      wethStrategy,
      ghstStrategy,
      quickStrategy,
      usdcStrategy,
      usdPriceModule,
      nonDacStrategy,
      diffAssetStrategy,
      dupStrategy,
    };
}
  
async function setUsdPriceModule(usdPriceModule: UsdPriceModule) {
    await usdPriceModule.addUsdPriceFeed(wmaticAddress, wmaticOracle);
    await usdPriceModule.addUsdPriceFeed(wethAddress, wethOracle);
    await usdPriceModule.addUsdPriceFeed(ghstAddress, ghstOracle);
    await usdPriceModule.addUsdPriceFeed(quickAddress, quickOracle);
    await usdPriceModule.addUsdPriceFeed(usdcAddress, usdcOracle);
    await usdPriceModule.addUsdPriceFeed(uniAddress, uniOracle);
}
  
async function setProduct(
    product: Product,
    wmaticStrategy: Strategy,
    wethStrategy: Strategy,
    ghstStrategy: Strategy,
    quickStrategy: Strategy,
    usdcStrategy: Strategy
) {
    // 나머지 asset add
    await product.addAsset(ghstAddress);
    await product.addAsset(quickAddress);
  
    // strategy add
    await product.addStrategy(wmaticStrategy.address);
    await product.addStrategy(ghstStrategy.address);
    await product.addStrategy(quickStrategy.address);
    await product.addStrategy(wethStrategy.address);
    await product.addStrategy(usdcStrategy.address);
  
    // update weight 해서 원하는 weight까지
    await product.updateWeight(
      [usdcAddress, ghstAddress, wmaticAddress, wethAddress, quickAddress],
      [30000, 5000, 40000, 20000, 5000]
    );
  
    // withdrawal queue update
    await product.updateWithdrawalQueue([
      wmaticStrategy.address,
      wethStrategy.address,
      usdcStrategy.address,
      ghstStrategy.address,
      quickStrategy.address,
    ]);
}
  
async function getTokens(dac: SignerWithAddress, nonDac: SignerWithAddress) {
    const wMaticContract = new ethers.Contract(wmaticAddress, wMaticAbi, dac);
    const wEthContract = new ethers.Contract(wethAddress, wEthAbi, dac);
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, dac);
    const quickContract = new ethers.Contract(quickAddress, quickAbi, dac);
    const ghstContract = new ethers.Contract(ghstAddress, ghstAbi, dac);
  
    // dac
    await wMaticContract.deposit({
      from: dac.address,
      value: ethers.utils.parseEther("1000"),
      gasLimit: 59999,
    });
  
    // nonDac
    await wMaticContract.connect(nonDac).deposit({
      from: nonDac.address,
      value: ethers.utils.parseEther("1000"),
      gasLimit: 59999,
    });

  
    return {
      wMaticContract,
      wEthContract,
      usdcContract,
      quickContract,
      ghstContract
    };
}

async function swapTokens(
    dac: SignerWithAddress, 
    nonDac: SignerWithAddress, 
    wMaticContract: Contract, 
    wEthContract: Contract, 
    usdcContract: Contract
) {
    const swapContract = new ethers.Contract(quickSwapRouter, quickSwapAbi, dac);

    // Dac
    let amountOut = parseUnits("3", 17);
    let path = [wmaticAddress, wethAddress];
    let amountIn = parseEther("450");

    await wMaticContract.approve(quickSwapRouter, amountIn);
    await swapContract.swapTokensForExactTokens(amountOut, amountIn, path, dac.address, Date.now() + 10000*60, {gasLimit: 251234});

    amountOut = parseUnits("300", 6);
    path = [wmaticAddress, usdcAddress];
    amountIn = parseEther("350");
    await wMaticContract.approve(quickSwapRouter, amountIn);
    await swapContract.swapTokensForExactTokens(amountOut, amountIn, path, dac.address, Date.now() + 10000*60, {gasLimit: 251234});

    // nonDac
    amountOut = parseUnits("3", 17);
    path = [wmaticAddress, wethAddress];
    amountIn = parseEther("450");

    await wMaticContract.connect(nonDac).approve(quickSwapRouter, amountIn);
     await swapContract.connect(nonDac).swapTokensForExactTokens(amountOut, amountIn, path, nonDac.address, Date.now() + 10000*60, {gasLimit: 251234});

    amountOut = parseUnits("300", 6);
    path = [wmaticAddress, usdcAddress];
    amountIn = parseEther("350");
    await wMaticContract.connect(nonDac).approve(quickSwapRouter, amountIn);
    await swapContract.connect(nonDac).swapTokensForExactTokens(amountOut, amountIn, path, nonDac.address, Date.now() + 10000*60, {gasLimit: 251234});
 

    return {swapContract};
}

async function activateProduct(dac: SignerWithAddress, product: Product, wMaticContract: Contract) {
    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    await product.activateProduct();
}

describe('usdc in test',async () => {
    it('usdc in - usdc out test',async () => {
        const {
            dac, nonDac,
            product, wmaticStrategy, 
            wethStrategy, ghstStrategy, 
            quickStrategy, usdcStrategy, 
            usdPriceModule
        } = await deployContracts();
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
        const {wMaticContract, wEthContract, usdcContract} =await getTokens(dac, nonDac);
        const {swapContract} = await swapTokens(dac, nonDac, wMaticContract, wEthContract, usdcContract);
        await activateProduct(dac, product, wMaticContract);
      
        // usdc로 100 deposit -> nonDac
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(usdcAddress, parseUnits("50", 6), nonDac.address);
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(usdcAddress, parseUnits("50", 6), nonDac.address);
      
        // portfolio의 잔액 확인
        console.log("portfolio value: ", await product.portfolioValue());
        console.log("product usdc balance: ", await product.assetBalance(usdcAddress));
        console.log("product wmatic balance: ", await product.assetFloatBalance(wmaticAddress));
      
        // user의 share token 잔액 확인
        console.log("nonDac's deposit value: ", await usdPriceModule.getAssetUsdValue(usdcAddress, parseUnits("100", 6)));
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 절반 usdc로 out
        let nonDacShareBalance = await product.balanceOf(nonDac.address);
        await product.connect(nonDac).withdraw(usdcAddress, nonDacShareBalance.div(2), nonDac.address, nonDac.address);

        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));

        // 절반 usdc로 out
        await product.connect(nonDac).withdraw(usdcAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
        
        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");
        
        console.log("product's total portfolio: ", await product.portfolioValue());

    })

    it('usdc in - weth out test',async () => {
        const {
            dac, nonDac,
            product, wmaticStrategy, 
            wethStrategy, ghstStrategy, 
            quickStrategy, usdcStrategy, 
            usdPriceModule
        } = await deployContracts();
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
        const {wMaticContract, wEthContract, usdcContract} =await getTokens(dac, nonDac);
        const {swapContract} = await swapTokens(dac, nonDac, wMaticContract, wEthContract, usdcContract);
        await activateProduct(dac, product, wMaticContract);
      
        // usdc로 100 deposit -> nonDac
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(usdcAddress, parseUnits("50", 6), nonDac.address);
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(usdcAddress, parseUnits("50", 6), nonDac.address);
      
        // portfolio의 잔액 확인
        console.log("portfolio value: ", await product.portfolioValue());
        console.log("product usdc balance: ", await product.assetBalance(usdcAddress));
        console.log("product wmatic balance: ", await product.assetFloatBalance(wmaticAddress));
      
        // user의 share token 잔액 확인
        console.log("nonDac's deposit value: ", await usdPriceModule.getAssetUsdValue(usdcAddress, parseUnits("100", 6)));
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 절반 weth으로 out
        let nonDacShareBalance = await product.balanceOf(nonDac.address);
        await product.connect(nonDac).withdraw(wethAddress, nonDacShareBalance.div(2), nonDac.address, nonDac.address);

        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));

        // 절반 weth으로 out
        await product.connect(nonDac).withdraw(wethAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
        
        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");
        
        console.log("product's total wmatic balance: ", await product.assetBalance(wmaticAddress));
        console.log("product's total weth balance: ", await product.assetBalance(wethAddress));
        console.log("product's total usdc balance: ", await product.assetBalance(usdcAddress));
        console.log("product's total portfolio value: ", await product.portfolioValue());
        console.log("user's total withdrawal value: ", await usdPriceModule.getAssetUsdValue(wethAddress, "59924353490344731"));
    })

    it('usdc in - wmatic out test',async () => {
        const {
            dac, nonDac,
            product, wmaticStrategy, 
            wethStrategy, ghstStrategy, 
            quickStrategy, usdcStrategy, 
            usdPriceModule
        } = await deployContracts();
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
        const {wMaticContract, wEthContract, usdcContract} =await getTokens(dac, nonDac);
        const {swapContract} = await swapTokens(dac, nonDac, wMaticContract, wEthContract, usdcContract);
        await activateProduct(dac, product, wMaticContract);
      
        // usdc로 100 deposit -> nonDac
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(usdcAddress, parseUnits("50", 6), nonDac.address);
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(usdcAddress, parseUnits("50", 6), nonDac.address);
      
        // portfolio의 잔액 확인
        console.log("portfolio value: ", await product.portfolioValue());
        console.log("product usdc balance: ", await product.assetBalance(usdcAddress));
        console.log("product wmatic balance: ", await product.assetFloatBalance(wmaticAddress));
      
        // user의 share token 잔액 확인
        console.log("nonDac's deposit value: ", await usdPriceModule.getAssetUsdValue(usdcAddress, parseUnits("100", 6)));
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 절반 wmatic으로 out
        let nonDacShareBalance = await product.balanceOf(nonDac.address);
        let nonDacWmaticBalance = await wMaticContract.balanceOf(nonDac.address);
        await product.connect(nonDac).withdraw(wmaticAddress, nonDacShareBalance.div(2), nonDac.address, nonDac.address);

        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 절반 wmatic으로 out
        await product.connect(nonDac).withdraw(wmaticAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
        
        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");
        
        console.log("product's total wmatic balance: ", await product.assetBalance(wmaticAddress));
        console.log("product's total weth balance: ", await product.assetBalance(wethAddress));
        console.log("product's total usdc balance: ", await product.assetBalance(usdcAddress));
        console.log("product's total portfolio value: ", await product.portfolioValue());
        console.log("user's total withdrawal value: ", await usdPriceModule.getAssetUsdValue(wmaticAddress, (await wMaticContract.balanceOf(nonDac.address)).sub(nonDacWmaticBalance)));
    })

})


import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract, Signer, utils } from "ethers";
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
const quickAddress = "0x831753dd7087cac61ab5644b308642cc1c33dc13";
const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

const wmaticOracle = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
const wethOracle = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
const ghstOracle = "0xDD229Ce42f11D8Ee7fFf29bDB71C7b81352e11be";
const quickOracle = "0xa058689f4bCa95208bba3F265674AE95dED75B6D";
const usdcOracle = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";

const uniAddress = "0xb33EaAd8d922B1083446DC23f610c2567fB5180f";
const uniOracle = "0xdf0Fb4e4F928d2dCB76f438575fDD8682386e13C";

async function deployContracts(dac: SignerWithAddress, nonDac: SignerWithAddress) {
    // Deploy the contract to the test network
    const Product = await ethers.getContractFactory("Product");
    const Strategy = await ethers.getContractFactory("Strategy");
    const UsdPriceModule = await ethers.getContractFactory("UsdPriceModule");

  
    const usdPriceModule = await UsdPriceModule.deploy();
    await usdPriceModule.deployed();
  
    const productInfo = {
        productName: "Quinoa test Product",
        productSymbol: "qTEST",
        dacName: "Quinoa DAC",
        dacAddress: dac.address,
        underlyingAssetAddress: usdcAddress,
        floatRatio: 20000,
        deviationThreshold: 5000
    }

    const product = await Product.deploy(productInfo, usdPriceModule.address, usdPriceModule.address, [wmaticAddress, wethAddress], quickSwapFactory, quickSwapRouter);
    await product.deployed();
  
    const wmaticStrategy = await Strategy.deploy(dac.address, wmaticAddress, product.address);
    await wmaticStrategy.deployed();
    const wethStrategy = await Strategy.deploy(dac.address, wethAddress, product.address);
    await wethStrategy.deployed();
    const ghstStrategy = await Strategy.deploy(dac.address, ghstAddress, product.address);
    await ghstStrategy.deployed();
    const quickStrategy = await Strategy.deploy(dac.address, quickAddress, product.address);
    await usdPriceModule.deployed();
    await quickStrategy.deployed();
    const usdcStrategy = await Strategy.deploy(dac.address, usdcAddress, product.address);
    await usdcStrategy.deployed();
  
    // non dac member depoly bad strategy 1
    const nonDacStrategy = await Strategy.connect(nonDac).deploy(
      nonDac.address, 
      wmaticAddress,
      product.address
    );
    await nonDacStrategy.deployed();
    // bad strategy 2 uses uni token that product doesn't use
    const diffAssetStrategy = await Strategy.deploy(dac.address, uniAddress, product.address);
    await diffAssetStrategy.deployed();
    // bad strategy 3 is duplicated strategy with wmaticStrategy
    const dupStrategy = await Strategy.deploy(dac.address, wmaticAddress, product.address);
    await dupStrategy.deployed();
  
    return {
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
  
async function distributionTokens(signers: SignerWithAddress[]) {
    const wMaticContract = new ethers.Contract(wmaticAddress, wMaticAbi, signers[0]);
    const wEthContract = new ethers.Contract(wethAddress, wEthAbi, signers[0]);
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, signers[0]);
    const quickContract = new ethers.Contract(quickAddress, quickAbi, signers[0]);
    const ghstContract = new ethers.Contract(ghstAddress, ghstAbi, signers[0]);
    const swapContract = new ethers.Contract(quickSwapRouter, quickSwapAbi, signers[0]);

    for(const val of signers) {
        // wmatic
        await wMaticContract
        .connect(val)
        .deposit
        ({
            from: val.address,
            value: ethers.utils.parseEther("1000"),
            gasLimit: 59999,
        });

        // weth
        let amountOut = parseUnits("3", 17);
        let path = [wmaticAddress, wethAddress];
        let amountIn = parseEther("450");
    
        await wMaticContract.connect(val).approve(quickSwapRouter, amountIn);
        await swapContract.connect(val).swapTokensForExactTokens(amountOut, amountIn, path, val.address, Date.now() + 10000*60, {gasLimit: 251234});
    
        // usdc
        amountOut = parseUnits("300", 6);
        path = [wmaticAddress, usdcAddress];
        amountIn = parseEther("350");

        await wMaticContract.connect(val).approve(quickSwapRouter, amountIn);
        await swapContract.connect(val).swapTokensForExactTokens(amountOut, amountIn, path, val.address, Date.now() + 10000*60, {gasLimit: 251234});
    }

    return {
        wMaticContract,
        wEthContract,
        usdcContract,
        quickContract,
        ghstContract,
        swapContract
      };
}

async function activateProduct(dac: SignerWithAddress, product: Product, wMaticContract: Contract) {
    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    await product.activateProduct();
}

describe("wMatic token deposit & random token withdraw test",async () => {
    it("wMatic token deposit & random token withdraw; without rebalance",async () => {
        const signers = await ethers.getSigners();
        const {
            product, wmaticStrategy, 
            wethStrategy, ghstStrategy, 
            quickStrategy, usdcStrategy, 
            usdPriceModule
        } = await deployContracts(signers[0], signers[1]);
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
        const { 
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        } =await distributionTokens(signers);
        await activateProduct(signers[0], product, wMaticContract);
        
        let dacInitialDepositValue = await usdPriceModule.getAssetUsdValue(wmaticAddress, parseEther("200"));
        let productInitialShareBalance = await product.totalSupply();
        let productInitialPortfolioValue = await product.portfolioValue();
        let productInitialWmaticBalance = await product.assetBalance(wmaticAddress);

        expect(dacInitialDepositValue).equal(productInitialPortfolioValue);

        // Deposit logic
        let oneUserDepositValue = await usdPriceModule.getAssetUsdValue(wmaticAddress, parseEther("60"));
        let oneUserShareBalance = await usdPriceModule.getAssetUsdValue(wmaticAddress, parseEther("60"));
        let oneUserDepositWmaticBalance = parseEther("60");

        let depositValues = [];

        for (let i=2; i<signers.length; i++){
            await wMaticContract.connect(signers[i]).approve(product.address, ethers.utils.parseEther("60"));
            await product.connect(signers[i]).deposit(wmaticAddress, ethers.utils.parseEther("30"), signers[i].address);
            await product.connect(signers[i]).deposit(wmaticAddress, ethers.utils.parseEther("30"), signers[i].address);

            expect(await product.balanceOf(signers[i].address)).equal(oneUserShareBalance);

            depositValues.push(oneUserDepositValue);
        }

        let productDepositShareBalance = await product.totalSupply();
        let productDepositPortfolioValue = await product.portfolioValue();
        let productDepositWmaticBalance = await product.assetBalance(wmaticAddress);
        let productDepositWethBalance = await product.assetBalance(wethAddress);
        let productDepositUsdcBalance = await product.assetBalance(usdcAddress);
        let productDepositQuickBalance = await product.assetBalance(quickAddress);
        let productDepositGhstBalance = await product.assetBalance(ghstAddress);

        expect(productDepositShareBalance).equal(productInitialShareBalance.add(oneUserShareBalance.mul(18)));
        expect(productDepositPortfolioValue).equal(productInitialPortfolioValue.add(oneUserDepositValue.mul(18)));
        expect(productDepositWmaticBalance).equal(productInitialWmaticBalance.add(oneUserDepositWmaticBalance.mul(18)));
        expect(productDepositWethBalance.toString()).equal("0");
        expect(productDepositUsdcBalance.toString()).equal("0");
        expect(productDepositQuickBalance.toString()).equal("0");
        expect(productDepositGhstBalance.toString()).equal("0");

        // withdraw logic
        const withdrawalChoices = [wmaticAddress, wethAddress, usdcAddress];
        const withdrawalContracts = [wMaticContract, wEthContract, usdcContract];
        let withdrawValues = []
        let withdrawalAddresses = []
        let productWithdrawShareBalance = await product.totalSupply();

        for (let i=2; i<signers.length; i++) {
            let rand = Math.floor(Math.random() * 3);
            let withdrawalAddress = withdrawalChoices[rand];
            let withdrawalContract = withdrawalContracts[rand];
            let beforeWithdrawalBalance = await withdrawalContract.balanceOf(signers[i].address);

            productWithdrawShareBalance = await product.totalSupply();

            await product.connect(signers[i]).withdraw(withdrawalAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address);
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawalAddress, (await withdrawalContract.balanceOf(signers[i].address)).sub(beforeWithdrawalBalance));

            expect(productWithdrawShareBalance.sub(oneUserShareBalance)).equal(await product.totalSupply());

            withdrawValues.push(userWithdrawValue);
            withdrawalAddresses.push(withdrawalAddress);
        }

        productWithdrawShareBalance = await product.totalSupply();
        let productWithdrawPortfolioValue = await product.portfolioValue();
        let productWithdrawWmaticBalance = await product.assetBalance(wmaticAddress);
        let productWithdrawWethBalance = await product.assetBalance(wethAddress);
        let productWithdrawUsdcBalance = await product.assetBalance(usdcAddress);
        let productWithdrawQuickBalance = await product.assetBalance(quickAddress);
        let productWithdrawGhstBalance = await product.assetBalance(ghstAddress);

        let productWithdrawWmaticFloat = await product.assetFloatBalance(wmaticAddress);
        let productWithdrawWethFloat = await product.assetFloatBalance(wethAddress);
        let productWithdrawUsdcFloat = await product.assetFloatBalance(usdcAddress);
        let productWithdrawQuickFloat = await product.assetFloatBalance(quickAddress);
        let productWithdrawGhstFloat = await product.assetFloatBalance(ghstAddress);

        let productWithdrawWmaticValue = await product.assetValue(wmaticAddress);
        let productWithdrawWethValue = await product.assetValue(wethAddress);
        let productWithdrawUsdcValue = await product.assetValue(usdcAddress);
        let productWithdrawQuickValue = await product.assetValue(quickAddress);
        let productWithdrawGhstValue = await product.assetValue(ghstAddress);

        for (let i=0; i<depositValues.length; i++){
            console.log("input: wMatic - output: ", withdrawalAddresses[i]);
            console.log("signers[", i+2, "] deposit value: ", depositValues[i]);
            console.log("signers[", i+2, "] withdraw value: ", withdrawValues[i]);
            console.log("*")
        }

        console.log("-----------------------------------------------------------------------------------")


        expect(productWithdrawShareBalance).equal(await product.balanceOf(signers[0].address));
        expect(productWithdrawWmaticFloat).equal(productWithdrawWmaticBalance);
        expect(productWithdrawWethFloat).equal(productWithdrawWethBalance);
        expect(productWithdrawUsdcFloat).equal(productWithdrawUsdcBalance);
        expect(productWithdrawQuickFloat).equal(productWithdrawQuickBalance);
        expect(productWithdrawGhstFloat).equal(productWithdrawGhstBalance);

        console.log("Initial product portfolio: ", productInitialPortfolioValue);
        console.log("After all withdraw product portfolio: ", productWithdrawPortfolioValue)
        console.log("product wmatic balance: ", productWithdrawWmaticBalance);
        console.log("product weth balance: ", productWithdrawWethBalance);
        console.log("product usdc balance: ", productWithdrawUsdcBalance);
        console.log("product quick balance: ", productWithdrawQuickBalance);
        console.log("product ghst balance: ", productWithdrawGhstBalance);


        console.log("-----------------------------------------------------------------------------------")

        console.log("dac deposit value: ", dacInitialDepositValue);
        console.log("dac withdraw value: ", await product.shareValue(await product.balanceOf(signers[0].address)));
    })
})

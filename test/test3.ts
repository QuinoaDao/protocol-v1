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
const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const ghstAddress = "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7";
const quickAddress = "0x831753dd7087cac61ab5644b308642cc1c33dc13";

const wmaticOracle = "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0";
const wethOracle = "0xF9680D99D6C9589e2a93a78A04A279e509205945";
const usdcOracle = "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7";
const ghstOracle = "0xDD229Ce42f11D8Ee7fFf29bDB71C7b81352e11be";
const quickOracle = "0xa058689f4bCa95208bba3F265674AE95dED75B6D";

const uniAddress = "0xb33EaAd8d922B1083446DC23f610c2567fB5180f";
const uniOracle = "0xdf0Fb4e4F928d2dCB76f438575fDD8682386e13C";

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

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
    const usdcStrategy = await Strategy.deploy(dac.address, usdcAddress, product.address);
    await usdcStrategy.deployed();
    const ghstStrategy = await Strategy.deploy(dac.address, ghstAddress, product.address);
    await ghstStrategy.deployed();
    const quickStrategy = await Strategy.deploy(dac.address, quickAddress, product.address);await usdPriceModule.deployed();
    await quickStrategy.deployed();

    console.log("wmatic strategy: ", wmaticStrategy.address);
    console.log("weth strategy: ", wethStrategy.address);
    console.log("usdc strategy: ", usdcStrategy.address);
    console.log("ghst strategy: ", ghstStrategy.address);
    console.log("quick strategy: ", quickStrategy.address);

    return {
      product,
      wmaticStrategy,
      wethStrategy,
      usdcStrategy,
      ghstStrategy,
      quickStrategy,
      usdPriceModule
    };
}
  
async function setUsdPriceModule(usdPriceModule: UsdPriceModule) {
    await usdPriceModule.addUsdPriceFeed(wmaticAddress, wmaticOracle);
    await usdPriceModule.addUsdPriceFeed(wethAddress, wethOracle);
    await usdPriceModule.addUsdPriceFeed(usdcAddress, usdcOracle);
    await usdPriceModule.addUsdPriceFeed(uniAddress, uniOracle);
    await usdPriceModule.addUsdPriceFeed(ghstAddress, ghstOracle);
    await usdPriceModule.addUsdPriceFeed(quickAddress, quickOracle);
}
  
async function setProduct(
    product: Product,
    wmaticStrategy: Strategy,
    wethStrategy: Strategy,
    usdcStrategy: Strategy,
    ghstStrategy: Strategy,
    quickStrategy: Strategy
) {
    // strategy add
    await product.addAsset(ghstAddress);
    await product.addAsset(quickAddress);
    await product.addStrategy(wmaticStrategy.address);
    await product.addStrategy(wethStrategy.address);
    await product.addStrategy(usdcStrategy.address);
    await product.addStrategy(ghstStrategy.address);
    await product.addStrategy(quickStrategy.address);
  
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
      quickStrategy.address
    ]);
}
  
async function distributionTokens(signers: SignerWithAddress[]) {
    const wMaticContract = new ethers.Contract(wmaticAddress, wMaticAbi, signers[0]);
    const wEthContract = new ethers.Contract(wethAddress, wEthAbi, signers[0]);
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, signers[0]);
    const swapContract = new ethers.Contract(quickSwapRouter, quickSwapAbi, signers[0]);

    let cnt = 0;

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

        await delay(50);
        console.log("distribution: ", cnt);
        cnt+=1;
    }

    return {
        wMaticContract,
        wEthContract,
        usdcContract,
        swapContract
      };
}

async function activateProduct(dac: SignerWithAddress, product: Product, wMaticContract: Contract) {
    await wMaticContract.connect(dac).approve(product.address, ethers.utils.parseEther("200"));
    await product.connect(dac).deposit(wmaticAddress, ethers.utils.parseEther("200"), dac.address);
    await product.activateProduct();
}


describe("scenario 3",async () => {
    it('rebalancing 1번, quick/ghst 포함',async () => {
        const signers = await ethers.getSigners();
        const {
            product, wmaticStrategy, 
            wethStrategy, usdcStrategy, 
            ghstStrategy, quickStrategy,
            usdPriceModule
        } = await deployContracts(signers[0], signers[1]);
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, usdcStrategy, ghstStrategy, quickStrategy);
        const { 
            wMaticContract,
            wEthContract,
            usdcContract,
            swapContract
        } =await distributionTokens(signers);
        await activateProduct(signers[0], product, wMaticContract);
        
        let dacDepositValue = (await product.shareValue(await product.totalSupply())).toString();

        let productPortfolioValue_1 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_1 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_1 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_1 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_1 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_1 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_1 = (await product.assetValue(usdcAddress)).toString();
        let productBalance_quick_1 = (await product.assetBalance(quickAddress)).toString();
        let productBalance_ghst_1 = (await product.assetBalance(ghstAddress)).toString();
        let productValue_quick_1 = (await product.assetValue(quickAddress)).toString();
        let productValue_ghst_1 = (await product.assetValue(ghstAddress)).toString();

        // // Deposit logic
        const assetChoices = [wmaticAddress, wethAddress, usdcAddress];
        const assetContracts = [wMaticContract, wEthContract, usdcContract];
        
        let cnt = [100, 100, 100]
        let assetChoices_deposit = [wmaticAddress];
        let assetContracts_deposit = [wMaticContract];
        let assetValue_deposit = ["0"];

        for(let i=0; i<300; i++) {
            let rand = Math.floor(Math.random() * 3);
            while(cnt[rand] == 0) {
                rand = Math.floor(Math.random() * 3);
            }
            
            assetChoices_deposit.push(assetChoices[rand]);
            assetContracts_deposit.push(assetContracts[rand]);
            cnt[rand] -= 1;

            rand = Math.floor(Math.random() * (30*(10**18))) + 20*(10**18);
            assetValue_deposit.push(rand.toString());
        }

        // console.log(assetChoices_deposit);
        // console.log(assetValue_deposit);

        for (let i=1; i<301; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);

            await delay(50);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);

            console.log("deposit: ", i);
        }

        let productPortfolioValue_2 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_2 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_2 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_2 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_2 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_2 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_2 = (await product.assetValue(usdcAddress)).toString();
        let productBalance_quick_2 = (await product.assetBalance(quickAddress)).toString();
        let productBalance_ghst_2 = (await product.assetBalance(ghstAddress)).toString();
        let productValue_quick_2 = (await product.assetValue(quickAddress)).toString();
        let productValue_ghst_2 = (await product.assetValue(ghstAddress)).toString();

        // rebalance logic
        await product.rebalance();

        let productPortfolioValue_3 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_3 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_3 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_3 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_3 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_3 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_3 = (await product.assetValue(usdcAddress)).toString();
        let productBalance_quick_3 = (await product.assetBalance(quickAddress)).toString();
        let productBalance_ghst_3 = (await product.assetBalance(ghstAddress)).toString();
        let productValue_quick_3 = (await product.assetValue(quickAddress)).toString();
        let productValue_ghst_3 = (await product.assetValue(ghstAddress)).toString();

        // withdraw logic
        const assetChoices_withdraw = [wmaticAddress];
        const assetContracts_withdraw = [wMaticContract];
        cnt = [100, 100, 100];

        for(let i=0; i<300; i++) {
            let rand = Math.floor(Math.random() * 3);
            while(cnt[rand] == 0) {
                rand = Math.floor(Math.random() * 3);
            }
            
            assetChoices_withdraw.push(assetChoices[rand]);
            assetContracts_withdraw.push(assetContracts[rand]);
            cnt[rand] -= 1;
        }

        let assetValue_withdraw = ["0"];
        let user_shareBalance = ["0"];
        let user_estimatedWithdraw = ["0"];


        console.log("USER,TOKEN_PAIR,DEPOSIT,SHARE,WITHDRAW,ESTIMATED");
        // console.log("signer_num wmatic_balance weth_balance usdc_balance ghst_balance quick_balance total_value");
        for (let i=1; i<301; i++) {
            let withdrawAddress = assetChoices_withdraw[i];
            let withdrawContract = assetContracts_withdraw[i];
            let beforeUserBalance = await withdrawContract.balanceOf(signers[i].address);
            let user_share = await product.balanceOf(signers[i].address);
            user_shareBalance.push((user_share).toString());
            user_estimatedWithdraw.push((await product.shareValue(user_share)).toString());

            await delay(50);
            await product.connect(signers[i]).withdraw(withdrawAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address);
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawAddress, (await withdrawContract.balanceOf(signers[i].address)).sub(beforeUserBalance));

            assetValue_withdraw.push((userWithdrawValue).toString());

            console.log(i, assetChoices_deposit[i], "-", assetChoices_withdraw[i], user_shareBalance[i],assetValue_deposit[i], assetValue_withdraw[i], user_estimatedWithdraw[i]);
        }


        let productPortfolioValue_4 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_4 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_4 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_4 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_4 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_4 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_4 = (await product.assetValue(usdcAddress)).toString();
        let productBalance_quick_4 = (await product.assetBalance(quickAddress)).toString();
        let productBalance_ghst_4 = (await product.assetBalance(ghstAddress)).toString();
        let productValue_quick_4 = (await product.assetValue(quickAddress)).toString();
        let productValue_ghst_4 = (await product.assetValue(ghstAddress)).toString();

        let dacShareValue = (await product.shareValue(await product.totalSupply())).toString();

        let tokenPrice_wmatic = (await usdPriceModule.getAssetUsdPrice(wmaticAddress)).toString();
        let tokenPrice_weth = (await usdPriceModule.getAssetUsdPrice(wethAddress)).toString();
        let tokenPrice_usdc = (await usdPriceModule.getAssetUsdPrice(usdcAddress)).toString();
        let tokenPrice_quick = (await usdPriceModule.getAssetUsdPrice(quickAddress)).toString();
        let tokenPrice_ghst = (await usdPriceModule.getAssetUsdPrice(ghstAddress)).toString();
    
        ///////////////////////////////////////////////////////////////////////////////////////
        
        console.log("DEPOSIT_WITHDRAW_WITH_REBALANCING,assetName,assetBalance,assetValue,assetPrice,productPortfolio");

        // before deposit
        console.log("BEFORE_DEPOSIT,wMatic", productBalance_wmatic_1, productValue_wmatic_1, tokenPrice_wmatic, productPortfolioValue_1);
        console.log("BEFORE_DEPOSIT,wEth", productBalance_weth_1, productValue_weth_1, tokenPrice_weth, productPortfolioValue_1);
        console.log("BEFORE_DEPOSIT,usdc", productBalance_usdc_1, productValue_usdc_1, tokenPrice_usdc, productPortfolioValue_1);
        console.log("BEFORE_DEPOSIT,ghst", productBalance_ghst_1, productValue_ghst_1, tokenPrice_ghst, productPortfolioValue_1);
        console.log("BEFORE_DEPOSIT,quick", productBalance_quick_1, productValue_quick_1, tokenPrice_quick, productPortfolioValue_1);
        console.log("\n");

        // after deposit before rebalance
        console.log("BEFORE_REBALANCE,wMatic", productBalance_wmatic_2, productValue_wmatic_2, tokenPrice_wmatic, productPortfolioValue_2);
        console.log("BEFORE_REBALANCE,wEth", productBalance_weth_2, productValue_weth_2, tokenPrice_weth, productPortfolioValue_2);
        console.log("BEFORE_REBALANCE,usdc", productBalance_usdc_2, productValue_usdc_2, tokenPrice_usdc, productPortfolioValue_2);
        console.log("BEFORE_REBALANCE,ghst", productBalance_ghst_2, productValue_ghst_2, tokenPrice_ghst, productPortfolioValue_2);
        console.log("BEFORE_REBALANCE,quick", productBalance_quick_2, productValue_quick_2, tokenPrice_quick, productPortfolioValue_2);
        console.log("\n");

        // after withdraw
        console.log("AFTER_REBALANCE,wMatic", productBalance_wmatic_3, productValue_wmatic_3, tokenPrice_wmatic, productPortfolioValue_3);
        console.log("AFTER_REBALANCE,wEth", productBalance_weth_3, productValue_weth_3, tokenPrice_weth, productPortfolioValue_3);
        console.log("AFTER_REBALANCE,usd", productBalance_usdc_3, productValue_usdc_3, tokenPrice_usdc, productPortfolioValue_3);
        console.log("AFTER_REBALANCE,ghst", productBalance_ghst_3, productValue_ghst_3, tokenPrice_ghst, productPortfolioValue_3);
        console.log("AFTER_REBALANCE,quick", productBalance_quick_3, productValue_quick_3, tokenPrice_quick, productPortfolioValue_3);
        console.log("\n");

        // after withdraw
        console.log("AFTER_WITHDRAW,wMatic", productBalance_wmatic_4, productValue_wmatic_4, tokenPrice_wmatic, productPortfolioValue_4);
        console.log("AFTER_WITHDRAW,wEth", productBalance_weth_4, productValue_weth_4, tokenPrice_weth, productPortfolioValue_4);
        console.log("AFTER_WITHDRAW,usd", productBalance_usdc_4, productValue_usdc_4, tokenPrice_usdc, productPortfolioValue_4);
        console.log("AFTER_WITHDRAW,ghst", productBalance_ghst_4, productValue_ghst_4, tokenPrice_ghst, productPortfolioValue_4);
        console.log("AFTER_WITHDRAW,quick", productBalance_quick_4, productValue_quick_4, tokenPrice_quick, productPortfolioValue_4);
        console.log("\n");

        // dac deposit-withdraw value
        console.log("DAC_DEPOSIT_VALUE", dacDepositValue);
        console.log("DAC_SHARE_VALUE", dacShareValue);

        let rand = Math.floor(Math.random() * 3);
        let withdrawalAddress = assetChoices[rand];
        let withdrawalContract: Contract;
        if(withdrawalAddress == usdcAddress) withdrawalContract = usdcContract;
        else if(withdrawalAddress == wmaticAddress) withdrawalContract = wMaticContract;
        else withdrawalContract = wEthContract;
        let beforeDacWithdraw = await withdrawalContract.balanceOf(signers[0].address);

        await product.deactivateProduct();
        await product.withdraw(withdrawalAddress, ethers.constants.MaxUint256, signers[0].address, signers[0].address);

        let dacWithdrawalValue = (await withdrawalContract.balanceOf(signers[0].address)).sub(beforeDacWithdraw)
        console.log("DAC_WITHDRAW_ADDRESS", withdrawalAddress);
        console.log("DAC_REAL_WITHDRAW_VALUE", (await usdPriceModule.getAssetUsdValue(withdrawalAddress, dacWithdrawalValue)).toString());
        console.log("AFTER_ALL_PORTFOLIO_VALUE", (await product.portfolioValue()).toString());
        console.log("AFTER_ALL_PRODUCT_BALANCE", 
        (await product.assetBalance(wmaticAddress)).toString(), 
        (await product.assetBalance(wethAddress)).toString(),
        (await product.assetBalance(usdcAddress)).toString(),
        (await product.assetBalance(quickAddress)).toString(),
        (await product.assetBalance(ghstAddress)).toString()
        );
        console.log("\n");


    })
})
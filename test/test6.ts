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
import quickSwapAbi from "../abis/quickSwapABI.json";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { days } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const wmaticAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const wethAddress = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

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

    console.log("wmatic strategy: ", wmaticStrategy.address);
    console.log("weth strategy: ", wethStrategy.address);
    console.log("usdc strategy: ", usdcStrategy.address);

    return {
      product,
      wmaticStrategy,
      wethStrategy,
      usdcStrategy,
      usdPriceModule
    };
}
  
async function setUsdPriceModule(usdPriceModule: UsdPriceModule) {
    await usdPriceModule.addUsdPriceFeed(wmaticAddress, wmaticOracle);
    await usdPriceModule.addUsdPriceFeed(wethAddress, wethOracle);
    await usdPriceModule.addUsdPriceFeed(usdcAddress, usdcOracle);
    await usdPriceModule.addUsdPriceFeed(uniAddress, uniOracle);

    console.log("wmatic price: ", await usdPriceModule.getAssetUsdPrice(wmaticAddress));
    console.log("weth price: ", await usdPriceModule.getAssetUsdPrice(wethAddress));
    console.log("usdc price: ", await usdPriceModule.getAssetUsdPrice(usdcAddress));
}
  
async function setProduct(
    product: Product,
    wmaticStrategy: Strategy,
    wethStrategy: Strategy,
    usdcStrategy: Strategy,
) {
    // strategy add
    await product.addStrategy(wmaticStrategy.address);
    await product.addStrategy(wethStrategy.address);
    await product.addStrategy(usdcStrategy.address);
  
    // update weight 해서 원하는 weight까지
    await product.updateWeight(
      [usdcAddress, wmaticAddress, wethAddress],
      [40000, 30000, 30000]
    );
  
    // withdrawal queue update
    await product.updateWithdrawalQueue([
      wmaticStrategy.address,
      wethStrategy.address,
      usdcStrategy.address
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

describe("scenario 5",async () => {
    it('USDC 거래량 더 많게, rebalancing 4번, quick/ghst 미포함',async () => {
        const signers = await ethers.getSigners();
        const {
            product, wmaticStrategy, 
            wethStrategy, usdcStrategy, 
            usdPriceModule
        } = await deployContracts(signers[0], signers[1]);
        await setUsdPriceModule(usdPriceModule);
        await setProduct(product, wmaticStrategy, wethStrategy, usdcStrategy);
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
        // deposit 1
        for (let i=1; i<151; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);
            
            await delay(50);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);

            // usdc를 사용하는 pair는 deposit 금액 더 많게
            if(depositAddress == usdcAddress || assetChoices_withdraw[i] == usdcAddress) {
                await depositContract.connect(signers[i]).approve(product.address, depositBalance);
                await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address); 
                assetValue_deposit[i] = (await usdPriceModule.getAssetUsdValue(depositAddress, depositBalance.mul(2))).toString();
            }

            console.log("deposit: ", i);
        }

        let productPortfolioValue_2 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_2 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_2 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_2 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_2 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_2 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_2 = (await product.assetValue(usdcAddress)).toString();

        // rebalance 1
        await product.rebalance();

        let productPortfolioValue_3 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_3 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_3 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_3 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_3 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_3 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_3 = (await product.assetValue(usdcAddress)).toString();

        // deposit 2
        for (let i=151; i<301; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);

            await delay(50);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);

            // usdc를 사용하는 pair는 deposit 금액 더 많게
            if(depositAddress == usdcAddress || assetChoices_withdraw[i] == usdcAddress) {
                await depositContract.connect(signers[i]).approve(product.address, depositBalance);
                await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address); 
                assetValue_deposit[i] = (await usdPriceModule.getAssetUsdValue(depositAddress, depositBalance.mul(2))).toString();
            }

            console.log("deposit: ", i);
        }

        let productPortfolioValue_4 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_4 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_4 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_4 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_4 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_4 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_4 = (await product.assetValue(usdcAddress)).toString();

        // rebalance 2
        await product.rebalance();

        let productPortfolioValue_5 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_5 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_5 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_5 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_5 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_5 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_5 = (await product.assetValue(usdcAddress)).toString();


        // withdraw logic

        let assetValue_withdraw = ["0"];
        let user_shareBalance = ["0"];
        let user_estimatedWithdraw = ["0"];

        // withdraw 1
        console.log("USER,TOKEN_PAIR,DEPOSIT,SHARE,WITHDRAW,ESTIMATED");
        
        for (let i=1; i<151; i++) {
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

        let productPortfolioValue_6 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_6 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_6 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_6 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_6 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_6 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_6 = (await product.assetValue(usdcAddress)).toString();

        // rebalance 3
        await product.rebalance();

        let productPortfolioValue_7 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_7 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_7 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_7 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_7 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_7 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_7 = (await product.assetValue(usdcAddress)).toString();
        
        // withdraw 2
        for (let i=151; i<301; i++) {
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
        
        let productPortfolioValue_8 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_8 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_8 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_8 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_8 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_8 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_8 = (await product.assetValue(usdcAddress)).toString();

        // rebalance 4
        await product.rebalance();

        let productPortfolioValue_9 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_9 = (await product.assetBalance(wmaticAddress)).toString();
        let productBalance_weth_9 = (await product.assetBalance(wethAddress)).toString();
        let productBalance_usdc_9 = (await product.assetBalance(usdcAddress)).toString();
        let productValue_wmatic_9 = (await product.assetValue(wmaticAddress)).toString();
        let productValue_weth_9 = (await product.assetValue(wethAddress)).toString();
        let productValue_usdc_9 = (await product.assetValue(usdcAddress)).toString();

        let dacShareValue = (await product.shareValue(await product.totalSupply())).toString();


        let tokenPrice_wmatic = (await usdPriceModule.getAssetUsdPrice(wmaticAddress)).toString();
        let tokenPrice_weth = (await usdPriceModule.getAssetUsdPrice(wethAddress)).toString();
        let tokenPrice_usdc = (await usdPriceModule.getAssetUsdPrice(usdcAddress)).toString();
    
        ///////////////////////////////////////////////////////////////////////////////////////
        
        console.log("DEPOSIT_WITHDRAW_WITH_REBALANCING,assetName,assetBalance,assetValue,assetPrice,productPortfolio");

        // before deposit
        console.log("BEFORE_DEPOSIT,wMatic", productBalance_wmatic_1, productValue_wmatic_1, tokenPrice_wmatic, productPortfolioValue_1);
        console.log("BEFORE_DEPOSIT,wEth", productBalance_weth_1, productValue_weth_1, tokenPrice_weth, productPortfolioValue_1);
        console.log("BEFORE_DEPOSIT,usdc", productBalance_usdc_1, productValue_usdc_1, tokenPrice_usdc, productPortfolioValue_1);
        console.log("\n");

        // after deposit before rebalance
        console.log("BEFORE_1,wMatic", productBalance_wmatic_2, productValue_wmatic_2, tokenPrice_wmatic, productPortfolioValue_2);
        console.log("BEFORE_1,wEth", productBalance_weth_2, productValue_weth_2, tokenPrice_weth, productPortfolioValue_2);
        console.log("BEFORE_1,usdc", productBalance_usdc_2, productValue_usdc_2, tokenPrice_usdc, productPortfolioValue_2);
        console.log("\n");

        // after withdraw
        console.log("AFTER_1,wMatic", productBalance_wmatic_3, productValue_wmatic_3, tokenPrice_wmatic, productPortfolioValue_3);
        console.log("AFTER_1,wEth", productBalance_weth_3, productValue_weth_3, tokenPrice_weth, productPortfolioValue_3);
        console.log("AFTER_1,usd", productBalance_usdc_3, productValue_usdc_3, tokenPrice_usdc, productPortfolioValue_3);
        console.log("\n");

        // after withdraw
        console.log("BEFORE_2,wMatic", productBalance_wmatic_4, productValue_wmatic_4, tokenPrice_wmatic, productPortfolioValue_4);
        console.log("BEFORE_2,wEth", productBalance_weth_4, productValue_weth_4, tokenPrice_weth, productPortfolioValue_4);
        console.log("BEFORE_2,usd", productBalance_usdc_4, productValue_usdc_4, tokenPrice_usdc, productPortfolioValue_4);
        console.log("\n");

        // before deposit
        console.log("AFTER_2,wMatic", productBalance_wmatic_5, productValue_wmatic_5, tokenPrice_wmatic, productPortfolioValue_5);
        console.log("AFTER_2,wEth", productBalance_weth_5, productValue_weth_5, tokenPrice_weth, productPortfolioValue_5);
        console.log("AFTER_2,usdc", productBalance_usdc_5, productValue_usdc_5, tokenPrice_usdc, productPortfolioValue_5);
        console.log("\n");

        // after deposit before rebalance
        console.log("BEROE_3,wMatic", productBalance_wmatic_6, productValue_wmatic_6, tokenPrice_wmatic, productPortfolioValue_6);
        console.log("BEROE_3,wEth", productBalance_weth_6, productValue_weth_6, tokenPrice_weth, productPortfolioValue_6);
        console.log("BEROE_3,usdc", productBalance_usdc_6, productValue_usdc_6, tokenPrice_usdc, productPortfolioValue_6);
        console.log("\n");

        // after withdraw
        console.log("AFTER_3,wMatic", productBalance_wmatic_7, productValue_wmatic_7, tokenPrice_wmatic, productPortfolioValue_7);
        console.log("AFTER_3,wEth", productBalance_weth_7, productValue_weth_7, tokenPrice_weth, productPortfolioValue_7);
        console.log("AFTER_3,usd", productBalance_usdc_7, productValue_usdc_7, tokenPrice_usdc, productPortfolioValue_7);
        console.log("\n");

        // after withdraw
        console.log("BEFORE_4,wMatic", productBalance_wmatic_8, productValue_wmatic_8, tokenPrice_wmatic, productPortfolioValue_8);
        console.log("BEFORE_4,wEth", productBalance_weth_8, productValue_weth_8, tokenPrice_weth, productPortfolioValue_8);
        console.log("BEFORE_4,usd", productBalance_usdc_8, productValue_usdc_8, tokenPrice_usdc, productPortfolioValue_8);
        console.log("\n");

        // after withdraw
        console.log("AFTER_4,wMatic", productBalance_wmatic_9, productValue_wmatic_9, tokenPrice_wmatic, productPortfolioValue_9);
        console.log("AFTER_4,wEth", productBalance_weth_9, productValue_weth_9, tokenPrice_weth, productPortfolioValue_9);
        console.log("AFTER_4,usd", productBalance_usdc_9, productValue_usdc_9, tokenPrice_usdc, productPortfolioValue_9);
        console.log("\n");

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
        (await product.assetBalance(usdcAddress)).toString()
        );
        console.log("\n");

    })
})
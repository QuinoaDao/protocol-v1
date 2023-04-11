import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect, util } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";

describe("rebalance test 2",async () => {
    it("random token deposit & random token withdraw; with rebalance",async () => {
        const signers = await ethers.getSigners();
        const {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry
        } = await utils.deployContracts(signers[0]);
        await utils.setUsdPriceModule(signers[0], usdPriceModule);
        await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    
        const {
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        } = await utils.distributionTokens(signers);
        await utils.activateProduct(signers[0], product, wMaticContract);
        
        let dacInitialDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("200"));
        let productInitialShareBalance = await product.totalSupply();
        let productInitialPortfolioValue = await product.portfolioValue();
        let productInitialWmaticBalance = await product.assetBalance(utils.wmaticAddress);
        
        expect(dacInitialDepositValue).equal(productInitialPortfolioValue);

        // First Deposit logic
        const depositChoices = [utils.wmaticAddress, utils.wethAddress, utils.usdcAddress];
        const depositContracts = [wMaticContract, wEthContract, usdcContract];
        const depositBalances = [parseEther("30"), parseUnits("25", 15), parseUnits("45", 6)];
        let depositValues_1 = [];
        let depositAddresses_1 = []

        for (let i=1; i<signers.length; i++){
            let rand = Math.floor(Math.random() * 3);
            let depositAddress = depositChoices[rand];
            let depositContract = depositContracts[rand];
            let depositBalance = depositBalances[rand];
            let depositValue = await usdPriceModule.getAssetUsdValue(depositAddress, depositBalance);

            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);

            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);
            await utils.delay(50);

            expect(await product.balanceOf(signers[i].address)).equal(depositValue);

            depositValues_1.push(depositValue);
            depositAddresses_1.push(depositAddress);

        }

        const assetAddresses = [utils.wmaticAddress, utils.wethAddress, utils.usdcAddress, utils.quickAddress, utils.ghstAddress]; 
        console.log("REBALANCING_TEST_RESULT");
        
        console.log("\nbefore_rebalance_portfolio_value,", (await product.portfolioValue()).toString());
        console.log("assetName,assetBalance,assetValue,assetPrice");
        for(let i=0; i<assetAddresses.length; i++){
            console.log(assetAddresses[i], ",", (await product.assetBalance(assetAddresses[i])).toString(), ",", (await product.assetValue(assetAddresses[i])).toString(), ",", (await usdPriceModule.getAssetUsdPrice(assetAddresses[i])).toString());
        }
        // rebalance 진행
        await product.rebalance();
        console.log("\nafter_rebalance_portfolio_value,", (await product.portfolioValue()).toString());
        console.log("assetName,assetBalance,assetValue,assetPrice");
        for(let i=0; i<assetAddresses.length; i++){
            console.log(assetAddresses[i], ",", (await product.assetBalance(assetAddresses[i])).toString(), ",", (await product.assetValue(assetAddresses[i])).toString(), ",", (await usdPriceModule.getAssetUsdPrice(assetAddresses[i])).toString());
        }

        // First withdraw logic: 절반의 인원만 withdraw
        const withdrawalChoices = [utils.wmaticAddress, utils.wethAddress, utils.usdcAddress];
        const withdrawalContracts = [wMaticContract, wEthContract, usdcContract];
        let withdrawValues_1 = []
        let withdrawalAddresses_1 = []
        let productWithdrawShareBalance = await product.totalSupply();

        for (let i=1; i<signers.length; i++) {
            let rand = Math.floor(Math.random() * 3);
            let withdrawalAddress = withdrawalChoices[rand];
            let withdrawalContract = withdrawalContracts[rand];
            let beforeWithdrawalBalance = await withdrawalContract.balanceOf(signers[i].address);

            productWithdrawShareBalance = await product.totalSupply();

            await product.connect(signers[i]).withdraw(withdrawalAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address);
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawalAddress, (await withdrawalContract.balanceOf(signers[i].address)).sub(beforeWithdrawalBalance));
            await utils.delay(50);

            withdrawValues_1.push(userWithdrawValue);
            withdrawalAddresses_1.push(withdrawalAddress);

        }

        console.log("\nbefore_rebalance_portfolio_value,",(await product.portfolioValue()).toString());
        console.log("assetName,assetBalance,assetValue,assetPrice");
        for(let i=0; i<assetAddresses.length; i++){
            console.log(assetAddresses[i], ",", (await product.assetBalance(assetAddresses[i])).toString(), ",", (await product.assetValue(assetAddresses[i])).toString(), ",", (await usdPriceModule.getAssetUsdPrice(assetAddresses[i])).toString());
        }
        // rebalance 진행
        await product.rebalance();
        console.log("\nafter_rebalance_portfolio_value,",(await product.portfolioValue()).toString());
        console.log("assetName,assetBalance,assetValue,assetPrice");
        for(let i=0; i<assetAddresses.length; i++){
            console.log(assetAddresses[i], ",", (await product.assetBalance(assetAddresses[i])).toString(), ",", (await product.assetValue(assetAddresses[i])).toString(), ",", (await usdPriceModule.getAssetUsdPrice(assetAddresses[i])).toString());
        }

        // Second Deposit 진행
        let depositValues_2 = [];
        let depositAddresses_2 = []

        for (let i=1; i<signers.length; i++){
            let rand = Math.floor(Math.random() * 3);
            let depositAddress = depositChoices[rand];
            let depositContract = depositContracts[rand];
            let depositBalance = depositBalances[rand];
            let depositValue = await usdPriceModule.getAssetUsdValue(depositAddress, depositBalance);

            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);
            
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);
            await utils.delay(50);

            depositValues_2.push(depositValue);
            depositAddresses_2.push(depositAddress);

        }
        
        console.log("\nbefore_rebalance_portfolio_value,",(await product.portfolioValue()).toString());
        console.log("assetName,assetBalance,assetValue,assetPrice");
        for(let i=0; i<assetAddresses.length; i++){
            console.log(assetAddresses[i], ",", (await product.assetBalance(assetAddresses[i])).toString(), ",", (await product.assetValue(assetAddresses[i])).toString(), ",", (await usdPriceModule.getAssetUsdPrice(assetAddresses[i])).toString());
        }
        // rebalance 진행
        await product.rebalance();
        console.log("\nafter_rebalance_portfolio_value,",(await product.portfolioValue()).toString());
        console.log("assetName,assetBalance,assetValue,assetPrice");
        for(let i=0; i<assetAddresses.length; i++){
            console.log(assetAddresses[i], ",", (await product.assetBalance(assetAddresses[i])).toString(), ",", (await product.assetValue(assetAddresses[i])).toString(), ",", (await usdPriceModule.getAssetUsdPrice(assetAddresses[i])).toString());
        }

        // Second Withdraw 진행 -> 전부 withdraw
        let withdrawValues_2 = []
        let withdrawalAddresses_2 = []
        productWithdrawShareBalance = await product.totalSupply();

        for (let i=1; i<signers.length; i++) {
            let rand = Math.floor(Math.random() * 3);
            let withdrawalAddress = withdrawalChoices[rand];
            let withdrawalContract = withdrawalContracts[rand];
            let beforeWithdrawalBalance = await withdrawalContract.balanceOf(signers[i].address);

            productWithdrawShareBalance = await product.totalSupply();

            await product.connect(signers[i]).withdraw(withdrawalAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address);
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawalAddress, (await withdrawalContract.balanceOf(signers[i].address)).sub(beforeWithdrawalBalance));
            await utils.delay(50);

            withdrawValues_2.push(userWithdrawValue);
            withdrawalAddresses_2.push(withdrawalAddress);

        }

        console.log("\nbefore_rebalance_portfolio_value, ",(await product.portfolioValue()).toString());
        console.log("assetName,assetBalance,assetValue,assetPrice");
        for(let i=0; i<assetAddresses.length; i++){
            console.log(assetAddresses[i], ",", (await product.assetBalance(assetAddresses[i])).toString(), ",", (await product.assetValue(assetAddresses[i])).toString(), ",", (await usdPriceModule.getAssetUsdPrice(assetAddresses[i])).toString());
        }
        // rebalance 진행
        await product.rebalance();
        console.log("\nafter_rebalance_portfolio_value, ",(await product.portfolioValue()).toString());
        console.log("assetName,assetBalance,assetValue,assetPrice");
        for(let i=0; i<assetAddresses.length; i++){
            console.log(assetAddresses[i], ",", (await product.assetBalance(assetAddresses[i])).toString(), ",", (await product.assetValue(assetAddresses[i])).toString(), ",", (await usdPriceModule.getAssetUsdPrice(assetAddresses[i])).toString());
        }

        //////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////// report ////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////

        console.log("users deposit value vs withdraw value");
        for (let i=2; i<signers.length; i++) {
            console.log('*');
            console.log('signer[', i, '] deposit value: ', (depositValues_1[i-2]).add(depositValues_2[i-2]));
            if(withdrawValues_1[i-2] == undefined) console.log('signer[', i, '] withdraw value: ', withdrawValues_2[i-2]);
            else console.log('signer[', i, '] withdraw value: ', (withdrawValues_1[i-2]).add(withdrawValues_2[i-2]));
        }
        
        console.log("-------------------------------------------------------------------------------")

        console.log("dac deposit value: ", dacInitialDepositValue);
        console.log("dac share balance: ", await product.balanceOf(signers[0].address));
        console.log("dac share value: ", await product.shareValue(await product.balanceOf(signers[0].address)));

        console.log("-----------------------------------------------------------------------------------")

        let rand = Math.floor(Math.random() * 3);
        let withdrawalAddress = withdrawalChoices[rand];
        let withdrawalContract = withdrawalContracts[rand];
        let beforeDacWithdraw = await withdrawalContract.balanceOf(signers[0].address);

        await product.deactivateProduct();
        await product.withdraw(withdrawalAddress, ethers.constants.MaxUint256, signers[0].address, signers[0].address);

        let dacWithdrawalValue = (await withdrawalContract.balanceOf(signers[0].address)).sub(beforeDacWithdraw)

        console.log("dac real withdraw value: ", (await usdPriceModule.getAssetUsdValue(withdrawalAddress, dacWithdrawalValue)).toString());
        console.log("product portfolio vlaue: ", (await product.portfolioValue()).toString());

    })
})


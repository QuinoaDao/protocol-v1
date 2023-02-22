import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect, util } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";

describe("rebalance test",async () => {
    it("wmatic token deposit & random token withdraw; with rebalance",async () => {
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
        await utils.setProductWithAllStrategy(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    
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

        // Deposit logic
        let oneUserDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("60"));
        let oneUserShareBalance = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("60"));
        let oneUserDepositWmaticBalance = parseEther("60");

        let beforeDepositWmaticPrice = await usdPriceModule.getAssetUsdPrice(utils.wmaticAddress);
        let beforeDepositWethPrice = await usdPriceModule.getAssetUsdPrice(utils.wethAddress);
        let beforeDepositQuickPrice = await usdPriceModule.getAssetUsdPrice(utils.quickAddress);
        let beforeDepositGhstPrice = await usdPriceModule.getAssetUsdPrice(utils.ghstAddress);
        let beforeDepositUsdcPrice = await usdPriceModule.getAssetUsdPrice(utils.usdcAddress);

        for (let i=2; i<signers.length; i++){
            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);

            await wMaticContract.connect(signers[i]).approve(product.address, ethers.utils.parseEther("60"));

            await product.connect(signers[i]).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), signers[i].address);
            await product.connect(signers[i]).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), signers[i].address);

            expect(await product.balanceOf(signers[i].address)).equal(oneUserShareBalance);

        }

        let productDepositShareBalance = await product.totalSupply();
        let productDepositPortfolioValue = await product.portfolioValue();
        let productDepositWmaticBalance = await product.assetBalance(utils.wmaticAddress);
        let productDepositWethBalance = await product.assetBalance(utils.wethAddress);
        let productDepositUsdcBalance = await product.assetBalance(utils.usdcAddress);
        let productDepositQuickBalance = await product.assetBalance(utils.quickAddress);
        let productDepositGhstBalance = await product.assetBalance(utils.ghstAddress);

        expect(productDepositShareBalance).equal(productInitialShareBalance.add(oneUserShareBalance.mul(signers.length-2)));
        expect(productDepositPortfolioValue).equal(productInitialPortfolioValue.add(oneUserDepositValue.mul(signers.length-2)));
        expect(productDepositWmaticBalance).equal(productInitialWmaticBalance.add(oneUserDepositWmaticBalance.mul(signers.length-2)));
        expect(productDepositWethBalance.toString()).equal("0");
        expect(productDepositUsdcBalance.toString()).equal("0");
        expect(productDepositQuickBalance.toString()).equal("0");
        expect(productDepositGhstBalance.toString()).equal("0");

        // rebalance 진행
        await product.rebalance();

        let afterRebalanceWmaticPrice = await usdPriceModule.getAssetUsdPrice(utils.wmaticAddress);
        let afterRebalanceWethPrice = await usdPriceModule.getAssetUsdPrice(utils.wethAddress);
        let afterRebalanceQuickPrice = await usdPriceModule.getAssetUsdPrice(utils.quickAddress);
        let afterRebalanceGhstPrice = await usdPriceModule.getAssetUsdPrice(utils.ghstAddress);
        let afterRebalanceUsdcPrice = await usdPriceModule.getAssetUsdPrice(utils.usdcAddress);

        let productRebalanceShareBalance = await product.totalSupply();
        let productRebalancePortfolioValue = await product.portfolioValue();
        let productRebalanceWmaticBalance = await product.assetBalance(utils.wmaticAddress);
        let productRebalanceWethBalance = await product.assetBalance(utils.wethAddress);
        let productRebalanceUsdcBalance = await product.assetBalance(utils.usdcAddress);
        let productRebalanceQuickBalance = await product.assetBalance(utils.quickAddress);
        let productRebalanceGhstBalance = await product.assetBalance(utils.ghstAddress);

        let productReblanceWmaticFloat = await product.assetFloatBalance(utils.wmaticAddress);
        let productReblanceWethFloat = await product.assetFloatBalance(utils.wethAddress);
        let productReblanceUsdcFloat = await product.assetFloatBalance(utils.usdcAddress);
        let productReblanceQuickFloat = await product.assetFloatBalance(utils.quickAddress);
        let productReblanceGhstFloat = await product.assetFloatBalance(utils.ghstAddress);

        let strategyRebalanceWmaticBalance = await wmaticStrategy.totalAssets();
        let strategyRebalanceWethBalance = await wethStrategy.totalAssets();
        let strategyRebalanceUsdcBalance = await usdcStrategy.totalAssets();
        let strategyRebalanceQuickBalance = await quickStrategy.totalAssets();
        let strategyRebalanceGhstBalance = await ghstStrategy.totalAssets();

        let productRebalanceWmaticValue = await product.assetValue(utils.wmaticAddress);
        let productRebalanceWethValue = await product.assetValue(utils.wethAddress);
        let productRebalanceUsdcValue = await product.assetValue(utils.usdcAddress);
        let productRebalanceQuickValue = await product.assetValue(utils.quickAddress);
        let productRebalanceGhstValue = await product.assetValue(utils.ghstAddress);

        expect(productRebalanceShareBalance).equal(productDepositShareBalance);
        expect(productRebalanceWmaticBalance).equal(productReblanceWmaticFloat.add(strategyRebalanceWmaticBalance));
        expect(productRebalanceWethBalance).equal(productReblanceWethFloat.add(strategyRebalanceWethBalance));
        expect(productRebalanceUsdcBalance).equal(productReblanceUsdcFloat.add(strategyRebalanceUsdcBalance));
        expect(productRebalanceQuickBalance).equal(productReblanceQuickFloat.add(strategyRebalanceQuickBalance));
        expect(productRebalanceGhstBalance).equal(productReblanceGhstFloat.add(strategyRebalanceGhstBalance));
        expect(productRebalancePortfolioValue)
        .equal(productRebalanceWmaticValue.add(productRebalanceWethValue).add(productRebalanceUsdcValue).add(productRebalanceQuickValue).add(productRebalanceGhstValue));

        expect(productRebalanceWmaticBalance).equal((await wMaticContract.balanceOf(product.address)).add(await wMaticContract.balanceOf(wmaticStrategy.address)));
        expect(productRebalanceWethBalance).equal((await wEthContract.balanceOf(product.address)).add(await wEthContract.balanceOf(wethStrategy.address)))
        expect(productRebalanceUsdcBalance).equal((await usdcContract.balanceOf(product.address)).add(await usdcContract.balanceOf(usdcStrategy.address)));
        expect(productRebalanceQuickBalance).equal((await quickContract.balanceOf(product.address)).add(await quickContract.balanceOf(quickStrategy.address)));
        expect(productRebalanceGhstBalance).equal((await ghstContract.balanceOf(product.address)).add(await ghstContract.balanceOf(ghstStrategy.address)));
        
        console.log("after deposit portfolio value: ", productDepositPortfolioValue);
        console.log("after reblance portfolio value: ", productRebalancePortfolioValue);
        console.log("-------------------------------------------------------------------------------")
        console.log("wmatic value: ", productRebalanceWmaticValue);
        console.log("weth value: ", productRebalanceWethValue);
        console.log("usdc value: ", productRebalanceUsdcValue);
        console.log("quick value: ", productRebalanceQuickValue);
        console.log("ghst value: ", productRebalanceGhstValue);
        console.log("-------------------------------------------------------------------------------")
        console.log("wmatic balance: ", productRebalanceWmaticBalance);
        console.log("weth balance: ", productRebalanceWethBalance);
        console.log("usdc balance: ", productRebalanceUsdcBalance);
        console.log("quick balance: ", productRebalanceQuickBalance);
        console.log("ghst balance: ", productRebalanceGhstBalance);
        console.log("-------------------------------------------------------------------------------")

        expect(beforeDepositWmaticPrice).equal(afterRebalanceWmaticPrice);
        expect(beforeDepositWethPrice).equal(afterRebalanceWethPrice);
        expect(beforeDepositUsdcPrice).equal(afterRebalanceUsdcPrice);
        expect(beforeDepositQuickPrice).equal(afterRebalanceQuickPrice);
        expect(beforeDepositGhstPrice).equal(afterRebalanceGhstPrice);

        // withdraw logic
        const withdrawalChoices = [utils.wmaticAddress, utils.wethAddress, utils.usdcAddress];
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

            withdrawValues.push(userWithdrawValue);
            withdrawalAddresses.push(withdrawalAddress);

        }


        productWithdrawShareBalance = await product.totalSupply();
        let productWithdrawPortfolioValue = await product.portfolioValue();
        let productWithdrawWmaticBalance = await product.assetBalance(utils.wmaticAddress);
        let productWithdrawWethBalance = await product.assetBalance(utils.wethAddress);
        let productWithdrawUsdcBalance = await product.assetBalance(utils.usdcAddress);
        let productWithdrawQuickBalance = await product.assetBalance(utils.quickAddress);
        let productWithdrawGhstBalance = await product.assetBalance(utils.ghstAddress);

        let productWithdrawWmaticFloat = await product.assetFloatBalance(utils.wmaticAddress);
        let productWithdrawWethFloat = await product.assetFloatBalance(utils.wethAddress);
        let productWithdrawUsdcFloat = await product.assetFloatBalance(utils.usdcAddress);
        let productWithdrawQuickFloat = await product.assetFloatBalance(utils.quickAddress);
        let productWithdrawGhstFloat = await product.assetFloatBalance(utils.ghstAddress);

        let productWithdrawWmaticValue = await product.assetValue(utils.wmaticAddress);
        let productWithdrawWethValue = await product.assetValue(utils.wethAddress);
        let productWithdrawUsdcValue = await product.assetValue(utils.usdcAddress);
        let productWithdrawQuickValue = await product.assetValue(utils.quickAddress);
        let productWithdrawGhstValue = await product.assetValue(utils.ghstAddress);

        for (let i=2; i<signers.length; i++) {
            console.log("input: wMatic - output: ", withdrawalAddresses[i-2]);
            console.log("signers[", i, "] deposit value: ", oneUserDepositValue);
            console.log("signers[", i, "] withdraw value: ", withdrawValues[i-2]);
            console.log("*")
        }

        console.log("-----------------------------------------------------------------------------------")


        expect(productWithdrawShareBalance).equal(await product.balanceOf(signers[0].address));
        expect(productWithdrawWmaticFloat.add(await wmaticStrategy.totalAssets())).equal(productWithdrawWmaticBalance);
        expect(productWithdrawWethFloat.add(await wethStrategy.totalAssets())).equal(productWithdrawWethBalance);
        expect(productWithdrawUsdcFloat.add(await usdcStrategy.totalAssets())).equal(productWithdrawUsdcBalance);
        expect(productWithdrawQuickFloat.add(await quickStrategy.totalAssets())).equal(productWithdrawQuickBalance);
        expect(productWithdrawGhstFloat.add(await ghstStrategy.totalAssets())).equal(productWithdrawGhstBalance);

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

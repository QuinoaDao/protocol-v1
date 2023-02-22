import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect, util } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";

describe("random token deposit & random token withdraw test",async () => {
    it("random token deposit & random token withdraw; without rebalance",async () => {
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
            swapContract
        } = await utils.distributionTokens(signers);
        await utils.activateProduct(signers[0], product, wMaticContract);
        
        let dacInitialDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("200"));
        let productInitialShareBalance = await product.totalSupply();
        let productInitialPortfolioValue = await product.portfolioValue();
        let productInitialWmaticBalance = await product.assetBalance(utils.wmaticAddress);

        expect(dacInitialDepositValue).equal(productInitialPortfolioValue);

        // Deposit logic
        const depositChoices = [utils.wmaticAddress, utils.wethAddress, utils.usdcAddress];
        const depositContracts = [wMaticContract, wEthContract, usdcContract];
        const depositBalances = [parseEther("30"), parseUnits("25", 15), parseUnits("45", 6)];
        let depositValues = [];
        let depositAddresses = []

        for (let i=2; i<signers.length; i++){
            let rand = Math.floor(Math.random() * 3);
            let depositAddress = depositChoices[rand];
            let depositContract = depositContracts[rand];
            let depositBalance = depositBalances[rand];
            let depositValue = await usdPriceModule.getAssetUsdValue(depositAddress, depositBalance);

            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);

            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);

            expect(await product.balanceOf(signers[i].address)).equal(depositValue);

            depositValues.push(depositValue);
            depositAddresses.push(depositAddress);
        }

        let productDepositShareBalance = await product.totalSupply();
        let productDepositPortfolioValue = await product.portfolioValue();
        let productDepositWmaticBalance = await product.assetBalance(utils.wmaticAddress);
        let productDepositWethBalance = await product.assetBalance(utils.wethAddress);
        let productDepositUsdcBalance = await product.assetBalance(utils.usdcAddress);
        let productDepositQuickBalance = await product.assetBalance(utils.quickAddress);
        let productDepositGhstBalance = await product.assetBalance(utils.ghstAddress);

        console.log("after deposit product wmatic balance: ", productDepositWmaticBalance);
        console.log("after deposit product weth balance: ", productDepositWethBalance);
        console.log("after deposit product usdc balance: ", productDepositUsdcBalance);
        console.log("after deposit product quick balance: ", productDepositQuickBalance);
        console.log("after deposit product ghst balance: ", productDepositGhstBalance);


        console.log("-----------------------------------------------------------------------------------")

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

            console.log("signer[", i, "] withdraw complete");
            console.log("signer withdraw token address: ", withdrawalAddress);
            console.log("--")
            console.log("after withdraw product wmatic balance: ", await product.assetBalance(utils.wmaticAddress));
            console.log("after withdraw product weth balance: ", await product.assetBalance(utils.wethAddress));
            console.log("after withdraw product usdc balance: ", await product.assetBalance(utils.usdcAddress));
            console.log("after withdraw product quick balance: ", await product.assetBalance(utils.quickAddress));
            console.log("after withdraw product ghst balance: ", await product.assetBalance(utils.ghstAddress));
            console.log("-----------------------------------------------------------------------------------")
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

        for (let i=0; i<depositValues.length; i++){
            console.log("input: ", depositAddresses[i], " - output: ", withdrawalAddresses[i]);
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
        console.log("after withdraw product wmatic balance: ", productWithdrawWmaticBalance);
        console.log("after withdraw product weth balance: ", productWithdrawWethBalance);
        console.log("after withdraw product usdc balance: ", productWithdrawUsdcBalance);
        console.log("after withdraw product quick balance: ", productWithdrawQuickBalance);
        console.log("after withdraw product ghst balance: ", productWithdrawGhstBalance);


        console.log("-----------------------------------------------------------------------------------")

        console.log("dac deposit value: ", dacInitialDepositValue);
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

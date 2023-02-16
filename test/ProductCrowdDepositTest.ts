import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect, util } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";

describe("wMatic token deposit & random token withdraw test",async () => {
    it("wMatic token deposit & random token withdraw; without rebalance",async () => {
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
        let oneUserDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("60"));
        let oneUserShareBalance = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("60"));
        let oneUserDepositWmaticBalance = parseEther("60");

        let depositValues = [];

        for (let i=2; i<signers.length; i++){
            expect(product.connect(signers[i]).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), signers[i].address)).revertedWith("You're not in whitelist");
            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);

            await wMaticContract.connect(signers[i]).approve(product.address, ethers.utils.parseEther("60"));
            await product.connect(signers[i]).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), signers[i].address);
            await product.connect(signers[i]).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), signers[i].address);

            expect(await product.balanceOf(signers[i].address)).equal(oneUserShareBalance);

            depositValues.push(oneUserDepositValue);
        }

        let productDepositShareBalance = await product.totalSupply();
        let productDepositPortfolioValue = await product.portfolioValue();
        let productDepositWmaticBalance = await product.assetBalance(utils.wmaticAddress);
        let productDepositWethBalance = await product.assetBalance(utils.wethAddress);
        let productDepositUsdcBalance = await product.assetBalance(utils.usdcAddress);
        let productDepositQuickBalance = await product.assetBalance(utils.quickAddress);
        let productDepositGhstBalance = await product.assetBalance(utils.ghstAddress);

        expect(productDepositShareBalance).equal(productInitialShareBalance.add(oneUserShareBalance.mul(signers.length -2)));
        expect(productDepositPortfolioValue).equal(productInitialPortfolioValue.add(oneUserDepositValue.mul(signers.length -2)));
        expect(productDepositWmaticBalance).equal(productInitialWmaticBalance.add(oneUserDepositWmaticBalance.mul(signers.length -2)));
        expect(productDepositWethBalance.toString()).equal("0");
        expect(productDepositUsdcBalance.toString()).equal("0");
        expect(productDepositQuickBalance.toString()).equal("0");
        expect(productDepositGhstBalance.toString()).equal("0");

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

            expect(productWithdrawShareBalance.sub(oneUserShareBalance)).equal(await product.totalSupply());

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

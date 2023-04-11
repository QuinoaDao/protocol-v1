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
        await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
    
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
            let tx1 = await (await product.connect(signers[i]).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), signers[i].address)).wait();
            let tx2 = await (await product.connect(signers[i]).deposit(utils.wmaticAddress, ethers.utils.parseEther("30"), signers[i].address)).wait();

            let tx1Args = tx1.events ? tx1.events[2].args : undefined;
            let tx2Args = tx2.events ? tx2.events[2].args : undefined;

            console.log("signers[", i, "] deposit complete");
            console.log("real deposit value: ", oneUserDepositValue);

            if(tx1Args != undefined && tx2Args != undefined) {
                console.log("event logging value: ", (tx1Args[3].mul(tx1Args[4].div(parseEther("1")))).add(tx2Args[3].mul(tx2Args[4].div(parseEther("1")))));
            }

            console.log("--");

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

            let tx = await (await product.connect(signers[i]).withdraw(withdrawalAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address)).wait();
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawalAddress, (await withdrawalContract.balanceOf(signers[i].address)).sub(beforeWithdrawalBalance));

            let txArgs = tx.events ? tx.events[tx.events.length - 1].args : undefined;

            console.log("signers[", i, "] withdraw complete");
            console.log("real withdra value: ", userWithdrawValue);

            if(txArgs != undefined) {
                console.log("event logging value: ", (txArgs[4].mul(txArgs[5])).div(parseEther("1")));
            }

            console.log("--");

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

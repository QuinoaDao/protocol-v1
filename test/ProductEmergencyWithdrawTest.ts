import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect, util } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";

describe("emergency withdraw test",async () => {
    it("withdraw all tokens to dac when emergency situation",async () => {
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
            ghstContract,
            quickContract
        } = await utils.distributionTokens(signers);
        await utils.activateProduct(signers[0], product, wMaticContract);
        
        let dacInitialDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("200"));
        let productInitialShareBalance = await product.totalSupply();
        let productInitialPortfolioValue = await product.portfolioValue();
        let productInitialWmaticBalance = await product.assetBalance(utils.wmaticAddress);
        expect(dacInitialDepositValue).equal(productInitialPortfolioValue);

        // Deposit logic
        const assetChoices = [utils.wmaticAddress, utils.wethAddress, utils.usdcAddress];
        const assetContracts = [wMaticContract, wEthContract, usdcContract];
        
        let cnt = [10, 10, 10]
        let assetChoices_deposit = [utils.wmaticAddress];
        let assetContracts_deposit = [wMaticContract];
        let assetValue_deposit = ["0"];

        for(let i=0; i<30; i++) {
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

        // deposit
        for (let i=1; i<31; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);

            await utils.delay(50);
            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);

        }

        console.log("--------------------------------------------------------------");
        console.log("before rebalance - product status");
        console.log("product wmatic balance: ", (await product.assetBalance(utils.wmaticAddress)).toString(), (await wmaticStrategy.totalAssets()).toString());
        console.log("product weth balance: ", (await product.assetBalance(utils.wethAddress)).toString(), (await wethStrategy.totalAssets()).toString());
        console.log("product usdc balance: ", (await product.assetBalance(utils.usdcAddress)).toString(), (await usdcStrategy.totalAssets()).toString());
        console.log("product ghst balance: ", (await product.assetBalance(utils.ghstAddress)).toString(), (await ghstStrategy.totalAssets()).toString());
        console.log("product quick balance: ", (await product.assetBalance(utils.quickAddress)).toString(), (await quickStrategy.totalAssets()).toString());
        console.log("product portfolio value: ", (await product.portfolioValue()).toString());
        console.log("--------------------------------------------------------------");
        // rebalance
        await (await product.rebalance()).wait();
        console.log("reblanace success");
        console.log("--------------------------------------------------------------");
        console.log("after rebalance - product status");
        console.log("product wmatic balance: ", (await product.assetBalance(utils.wmaticAddress)).toString(), (await wmaticStrategy.totalAssets()).toString());
        console.log("product weth balance: ", (await product.assetBalance(utils.wethAddress)).toString(), (await wethStrategy.totalAssets()).toString());
        console.log("product usdc balance: ", (await product.assetBalance(utils.usdcAddress)).toString(), (await usdcStrategy.totalAssets()).toString());
        console.log("product ghst balance: ", (await product.assetBalance(utils.ghstAddress)).toString(), (await ghstStrategy.totalAssets()).toString());
        console.log("product quick balance: ", (await product.assetBalance(utils.quickAddress)).toString(), (await quickStrategy.totalAssets()).toString());
        console.log("product portfolio value: ", (await product.portfolioValue()).toString());
        console.log("--------------------------------------------------------------");

        // deactivate product
        expect(await product.checkActivation()).equal(true);
        await (await product.deactivateProduct()).wait();
        expect(await product.checkActivation()).equal(false);
        console.log("deactivate product success");

        // withdraw all tokens
        // wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy
        const beforeWithdrawDacWmaticBalance = await wMaticContract.balanceOf(signers[0].address);
        const beforeWithdrawDacWethBalance = await wEthContract.balanceOf(signers[0].address);
        const beforeWithdrawDacUsdcBalance = await usdcContract.balanceOf(signers[0].address);
        const beforeWithdrawDacGhstBalance = await ghstContract.balanceOf(signers[0].address);
        const beforeWithdrawDacQuickBalance = await quickContract.balanceOf(signers[0].address);
        console.log("get dac balances success");

        const beforeWithdrawProductWmaticBalance = await product.assetBalance(utils.wmaticAddress);
        const beforeWithdrawProductWethBalance = await product.assetBalance(utils.wethAddress);
        const beforeWithdrawProductUsdcBalance = await product.assetBalance(utils.usdcAddress);
        const beforeWithdrawProductGhstBalance = await product.assetBalance(utils.ghstAddress);
        const beforeWithdrawProductQuickBalance = await product.assetBalance(utils.quickAddress);
        console.log("get product balances success");

        await (await product.emergencyWithdraw()).wait();
        console.log("emergencyWithdraw success");

        const afterWithdrawDacWmaticBalance = await wMaticContract.balanceOf(signers[0].address);
        const afterWithdrawDacWethBalance = await wEthContract.balanceOf(signers[0].address);
        const afterWithdrawDacUsdcBalance = await usdcContract.balanceOf(signers[0].address);
        const afterWithdrawDacGhstBalance = await ghstContract.balanceOf(signers[0].address);
        const afterWithdrawDacQuickBalance = await quickContract.balanceOf(signers[0].address);
        console.log("get dac balances success");

        const afterWithdrawProductWmaticBalance = await product.assetBalance(utils.wmaticAddress);
        const afterWithdrawProductWethBalance = await product.assetBalance(utils.wethAddress);
        const afterWithdrawProductUsdcBalance = await product.assetBalance(utils.usdcAddress);
        const afterWithdrawProductGhstBalance = await product.assetBalance(utils.ghstAddress);
        const afterWithdrawProductQuickBalance = await product.assetBalance(utils.quickAddress);
        console.log("get product balances success");

        expect((afterWithdrawProductWmaticBalance).toString()).equal("0");
        expect((afterWithdrawProductWethBalance).toString()).equal("0");
        expect((afterWithdrawProductUsdcBalance).toString()).equal("0");
        expect((afterWithdrawProductGhstBalance).toString()).equal("0");
        expect((afterWithdrawProductQuickBalance).toString()).equal("0");
        expect((await product.portfolioValue()).toString()).equal("0");
        console.log("product balances expect success");

        expect(beforeWithdrawDacWmaticBalance.add(beforeWithdrawProductWmaticBalance)).equal(afterWithdrawDacWmaticBalance);
        expect(beforeWithdrawDacWethBalance.add(beforeWithdrawProductWethBalance)).equal(afterWithdrawDacWethBalance);
        expect(beforeWithdrawDacUsdcBalance.add(beforeWithdrawProductUsdcBalance)).equal(afterWithdrawDacUsdcBalance);
        expect(beforeWithdrawDacGhstBalance.add(beforeWithdrawProductGhstBalance)).equal(afterWithdrawDacGhstBalance);
        expect(beforeWithdrawDacQuickBalance.add(beforeWithdrawProductQuickBalance)).equal(afterWithdrawDacQuickBalance);
        console.log("dac balances expect success");

    })
})

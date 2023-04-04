import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("rebalance 없는 버전 테스트",async () => {
    it('단순 deposit, withdraw',async () => {
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
        
        let dacDepositValue = (await product.shareValue(await product.totalSupply())).toString();

        let productPortfolioValue_1 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_1 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_1 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_1 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_1 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_1 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_1 = (await product.assetValue(utils.usdcAddress)).toString();

        // Deposit logic
        const assetChoices = [utils.wmaticAddress, utils.wethAddress, utils.usdcAddress];
        const assetContracts = [wMaticContract, wEthContract, usdcContract];
        let cnt = [100, 100, 100]
        let assetChoices_deposit = [utils.wmaticAddress];
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

        console.dir(assetChoices_deposit, {'maxArrayLength': null});
        console.dir(assetValue_deposit, {'maxArrayLength': null});

        for (let i=1; i<301; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);

            expect(product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address)).revertedWith("You're not in whitelist");

            await utils.delay(50);
            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);

        }

        let productPortfolioValue_2 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_2 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_2 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_2 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_2 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_2 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_2 = (await product.assetValue(utils.usdcAddress)).toString();

        // withdraw logic
        const assetChoices_withdraw = [utils.wmaticAddress];
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

        console.dir(assetChoices_withdraw, {'maxArrayLength': null});

        let assetValue_withdraw = ["0"];

        for (let i=1; i<301; i++) {
            let withdrawAddress = assetChoices_withdraw[i];
            let withdrawContract = assetContracts_withdraw[i];
            let beforeUserBalance = await withdrawContract.balanceOf(signers[i].address);

            await utils.delay(50);
            await product.connect(signers[i]).withdraw(withdrawAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address);
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawAddress, (await withdrawContract.balanceOf(signers[i].address)).sub(beforeUserBalance));

            assetValue_withdraw.push((userWithdrawValue).toString());
        }


        let dacWithdrawValue = (await product.shareValue(await product.totalSupply())).toString();
        let productPortfolioValue_3 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_3 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_3 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_3 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_3 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_3 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_3 = (await product.assetValue(utils.usdcAddress)).toString();

        let tokenPrice_wmatic = (await usdPriceModule.getAssetUsdPrice(utils.wmaticAddress)).toString();
        let tokenPrice_weth = (await usdPriceModule.getAssetUsdPrice(utils.wethAddress)).toString();
        let tokenPrice_usdc = (await usdPriceModule.getAssetUsdPrice(utils.usdcAddress)).toString();
    
        ///////////////////////////////////////////////////////////////////////////////////////
        
        console.log("DEPOSIT_WITHDRAW_WITHOUT_REBALANCING,assetName,assetBalance,assetValue,assetPrice,productPortfolio");

        // before deposit
        console.log("BEFORE_DEPOSIT,wMatic", productBalance_wmatic_1, productValue_wmatic_1, tokenPrice_wmatic, productPortfolioValue_1);
        console.log("BEFORE_DEPOSIT,wEth", productBalance_weth_1, productValue_weth_1, tokenPrice_weth, productPortfolioValue_1);
        console.log("BEFORE_DEPOSIT,usdc", productBalance_usdc_1, productValue_usdc_1, tokenPrice_usdc, productPortfolioValue_1);
        console.log("\n");

        // after deposit
        console.log("AFTER_DEPOSIT_BEFORE_WITHDRAW,wMatic", productBalance_wmatic_2, productValue_wmatic_2, tokenPrice_wmatic, productPortfolioValue_2);
        console.log("AFTER_DEPOSIT_BEFORE_WITHDRAW,wEth", productBalance_weth_2, productValue_weth_2, tokenPrice_weth, productPortfolioValue_2);
        console.log("AFTER_DEPOSIT_BEFORE_WITHDRAW,usdc", productBalance_usdc_2, productValue_usdc_2, tokenPrice_usdc, productPortfolioValue_2);
        console.log("\n");

        // after withdraw
        console.log("AFTER_WITHDRAW,wMatic", productBalance_wmatic_3, productValue_wmatic_3, tokenPrice_wmatic, productPortfolioValue_3);
        console.log("AFTER_WITHDRAW,wEth", productBalance_weth_3, productValue_weth_3, tokenPrice_weth, productPortfolioValue_3);
        console.log("AFTER_WITHDRAW,usd", productBalance_usdc_3, productValue_usdc_3, tokenPrice_usdc, productPortfolioValue_3);
        console.log("\n");

        // dac deposit-withdraw value
        console.log("DAC_DEPOSIT_VALUE", dacDepositValue);
        console.log("DAC_WITHDRAW_VALUE", dacWithdrawValue);
        console.log("\n");

        // user deposit-withdraw value
        console.log("USER,TOKEN_PAIR,DEPOSIT,WITHDRAW");
        for (let i=1; i<301; i++) {
            console.log(i, assetChoices_deposit[i], "-", assetChoices_withdraw[i], assetValue_deposit[i], assetValue_withdraw[i]);
        }

    })
})
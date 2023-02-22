import * as utils from "./utils";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("scenario 6",async () => {
    it('USDC 거래량 더 많게, rebalancing 4번, quick/ghst 미포함',async () => {
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
        
        let dacDepositValue = (await product.shareValue(await product.totalSupply())).toString();

        let productPortfolioValue_1 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_1 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_1 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_1 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_1 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_1 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_1 = (await product.assetValue(utils.usdcAddress)).toString();

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
        // deposit 1
        for (let i=1; i<151; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);
            
            await utils.delay(50);
            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);

            // usdc를 사용하는 pair는 deposit 금액 더 많게
            if(depositAddress == utils.usdcAddress || assetChoices_withdraw[i] == utils.usdcAddress) {
                await depositContract.connect(signers[i]).approve(product.address, depositBalance);
                await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address); 
                assetValue_deposit[i] = (await usdPriceModule.getAssetUsdValue(depositAddress, depositBalance.mul(2))).toString();
            }

        }

        let productPortfolioValue_2 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_2 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_2 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_2 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_2 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_2 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_2 = (await product.assetValue(utils.usdcAddress)).toString();

        // rebalance 1
        await product.rebalance();

        let productPortfolioValue_3 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_3 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_3 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_3 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_3 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_3 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_3 = (await product.assetValue(utils.usdcAddress)).toString();

        // deposit 2
        for (let i=151; i<301; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);

            await utils.delay(50);
            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);

            // usdc를 사용하는 pair는 deposit 금액 더 많게
            if(depositAddress == utils.usdcAddress || assetChoices_withdraw[i] == utils.usdcAddress) {
                await depositContract.connect(signers[i]).approve(product.address, depositBalance);
                await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address); 
                assetValue_deposit[i] = (await usdPriceModule.getAssetUsdValue(depositAddress, depositBalance.mul(2))).toString();
            }

        }

        let productPortfolioValue_4 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_4 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_4 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_4 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_4 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_4 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_4 = (await product.assetValue(utils.usdcAddress)).toString();

        // rebalance 2
        await product.rebalance();

        let productPortfolioValue_5 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_5 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_5 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_5 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_5 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_5 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_5 = (await product.assetValue(utils.usdcAddress)).toString();


        // withdraw logic
        let assetValue_withdraw = ["0"];
        let user_shareBalance = ["0"];
        let user_estimatedWithdraw = ["0"];

        // withdraw 1
        for (let i=1; i<151; i++) {
            let withdrawAddress = assetChoices_withdraw[i];
            let withdrawContract = assetContracts_withdraw[i];
            let beforeUserBalance = await withdrawContract.balanceOf(signers[i].address);
            let user_share = await product.balanceOf(signers[i].address);
            user_shareBalance.push((user_share).toString());
            user_estimatedWithdraw.push((await product.shareValue(user_share)).toString());

            await utils.delay(50);
            await product.connect(signers[i]).withdraw(withdrawAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address);
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawAddress, (await withdrawContract.balanceOf(signers[i].address)).sub(beforeUserBalance));

            assetValue_withdraw.push((userWithdrawValue).toString());
        }

        let productPortfolioValue_6 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_6 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_6 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_6 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_6 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_6 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_6 = (await product.assetValue(utils.usdcAddress)).toString();

        // rebalance 3
        await product.rebalance();

        let productPortfolioValue_7 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_7 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_7 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_7 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_7 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_7 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_7 = (await product.assetValue(utils.usdcAddress)).toString();
        
        // withdraw 2
        for (let i=151; i<301; i++) {
            let withdrawAddress = assetChoices_withdraw[i];
            let withdrawContract = assetContracts_withdraw[i];
            let beforeUserBalance = await withdrawContract.balanceOf(signers[i].address);
            let user_share = await product.balanceOf(signers[i].address);
            user_shareBalance.push((user_share).toString());
            user_estimatedWithdraw.push((await product.shareValue(user_share)).toString());

            await utils.delay(50);
            await product.connect(signers[i]).withdraw(withdrawAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address);
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawAddress, (await withdrawContract.balanceOf(signers[i].address)).sub(beforeUserBalance));

            assetValue_withdraw.push((userWithdrawValue).toString());
        }
        
        let productPortfolioValue_8 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_8 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_8 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_8 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_8 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_8 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_8 = (await product.assetValue(utils.usdcAddress)).toString();

        // rebalance 4
        await product.rebalance();

        let productPortfolioValue_9 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_9 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_9 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_9 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_9 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_9 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_9 = (await product.assetValue(utils.usdcAddress)).toString();

        let dacShareValue = (await product.shareValue(await product.totalSupply())).toString();


        let tokenPrice_wmatic = (await usdPriceModule.getAssetUsdPrice(utils.wmaticAddress)).toString();
        let tokenPrice_weth = (await usdPriceModule.getAssetUsdPrice(utils.wethAddress)).toString();
        let tokenPrice_usdc = (await usdPriceModule.getAssetUsdPrice(utils.usdcAddress)).toString();
    
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
        
        if(withdrawalAddress == utils.usdcAddress) withdrawalContract = usdcContract;
        else if(withdrawalAddress == utils.wmaticAddress) withdrawalContract = wMaticContract;
        else withdrawalContract = wEthContract;
        let beforeDacWithdraw = await withdrawalContract.balanceOf(signers[0].address);

        await product.deactivateProduct();
        await product.withdraw(withdrawalAddress, ethers.constants.MaxUint256, signers[0].address, signers[0].address);

        let dacWithdrawalValue = (await withdrawalContract.balanceOf(signers[0].address)).sub(beforeDacWithdraw)
        console.log("DAC_WITHDRAW_ADDRESS", withdrawalAddress);
        console.log("DAC_REAL_WITHDRAW_VALUE", (await usdPriceModule.getAssetUsdValue(withdrawalAddress, dacWithdrawalValue)).toString());
        console.log("AFTER_ALL_PORTFOLIO_VALUE", (await product.portfolioValue()).toString());
        console.log("AFTER_ALL_PRODUCT_BALANCE", 
        (await product.assetBalance(utils.wmaticAddress)).toString(), 
        (await product.assetBalance(utils.wethAddress)).toString(),
        (await product.assetBalance(utils.usdcAddress)).toString()
        );
        console.log("\n");

    })
})
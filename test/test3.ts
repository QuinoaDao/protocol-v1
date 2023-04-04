import * as utils from "./utils";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("scenario 3",async () => {
    it('rebalancing 1번, quick/ghst 포함',async () => {
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
        let productBalance_quick_1 = (await product.assetBalance(utils.quickAddress)).toString();
        let productBalance_ghst_1 = (await product.assetBalance(utils.ghstAddress)).toString();
        let productValue_quick_1 = (await product.assetValue(utils.quickAddress)).toString();
        let productValue_ghst_1 = (await product.assetValue(utils.ghstAddress)).toString();

        // // Deposit logic
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

        // console.log(assetChoices_deposit);
        // console.log(assetValue_deposit);

        for (let i=1; i<301; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);

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
        let productBalance_quick_2 = (await product.assetBalance(utils.quickAddress)).toString();
        let productBalance_ghst_2 = (await product.assetBalance(utils.ghstAddress)).toString();
        let productValue_quick_2 = (await product.assetValue(utils.quickAddress)).toString();
        let productValue_ghst_2 = (await product.assetValue(utils.ghstAddress)).toString();

        // rebalance logic
        await product.rebalance();

        let productPortfolioValue_3 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_3 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_3 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_3 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_3 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_3 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_3 = (await product.assetValue(utils.usdcAddress)).toString();
        let productBalance_quick_3 = (await product.assetBalance(utils.quickAddress)).toString();
        let productBalance_ghst_3 = (await product.assetBalance(utils.ghstAddress)).toString();
        let productValue_quick_3 = (await product.assetValue(utils.quickAddress)).toString();
        let productValue_ghst_3 = (await product.assetValue(utils.ghstAddress)).toString();

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

        let assetValue_withdraw = ["0"];
        let user_shareBalance = ["0"];
        let user_estimatedWithdraw = ["0"];


        for (let i=1; i<301; i++) {
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


        let productPortfolioValue_4 = (await product.portfolioValue()).toString();
        let productBalance_wmatic_4 = (await product.assetBalance(utils.wmaticAddress)).toString();
        let productBalance_weth_4 = (await product.assetBalance(utils.wethAddress)).toString();
        let productBalance_usdc_4 = (await product.assetBalance(utils.usdcAddress)).toString();
        let productValue_wmatic_4 = (await product.assetValue(utils.wmaticAddress)).toString();
        let productValue_weth_4 = (await product.assetValue(utils.wethAddress)).toString();
        let productValue_usdc_4 = (await product.assetValue(utils.usdcAddress)).toString();
        let productBalance_quick_4 = (await product.assetBalance(utils.quickAddress)).toString();
        let productBalance_ghst_4 = (await product.assetBalance(utils.ghstAddress)).toString();
        let productValue_quick_4 = (await product.assetValue(utils.quickAddress)).toString();
        let productValue_ghst_4 = (await product.assetValue(utils.ghstAddress)).toString();

        let dacShareValue = (await product.shareValue(await product.totalSupply())).toString();

        let tokenPrice_wmatic = (await usdPriceModule.getAssetUsdPrice(utils.wmaticAddress)).toString();
        let tokenPrice_weth = (await usdPriceModule.getAssetUsdPrice(utils.wethAddress)).toString();
        let tokenPrice_usdc = (await usdPriceModule.getAssetUsdPrice(utils.usdcAddress)).toString();
        let tokenPrice_quick = (await usdPriceModule.getAssetUsdPrice(utils.quickAddress)).toString();
        let tokenPrice_ghst = (await usdPriceModule.getAssetUsdPrice(utils.ghstAddress)).toString();
    
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
        (await product.assetBalance(utils.usdcAddress)).toString(),
        (await product.assetBalance(utils.quickAddress)).toString(),
        (await product.assetBalance(utils.ghstAddress)).toString()
        );
        console.log("\n");


    })
})
import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect, util } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { Product, UsdPriceModule, WhitelistRegistry } from "../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Usdc strategy test", async () => {
    async function deployAndSetting(signers: SignerWithAddress[]) {
        const productInfo = {
            productName: "Quinoa test Product",
            productSymbol: "qTEST",
            dacName: "Quinoa DAC",
            dacAddress: signers[0].address,
            underlyingAssetAddress: utils.quickAddress,
            floatRatio: 20000,
            deviationThreshold: 5000
        }

        const {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry
        } = await utils.deployWithCustomInfo("Product", signers[0], productInfo);
        await utils.setUsdPriceModule(signers[0], usdPriceModule);
        await utils.setProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, usdcStrategy, ghstStrategy, quickStrategy);

        const {
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
          } = await utils.distributionTokens(signers);
        
        await utils.activateProduct(signers[0], product, wMaticContract);
      
        await utils.setWhitelists(signers, whitelistRegistry, product.address);

        return {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry,
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        }
    }

    async function userDeposit(
        signers: SignerWithAddress[], 
        product: Product,
        wMaticContract: Contract, 
        wEthContract: Contract, 
        usdcContract: Contract,
        usdPriceModule: UsdPriceModule,
        whitelistRegistry: WhitelistRegistry
        ) {
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

        // deposit
        for (let i=1; i<signers.length; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);

            await utils.delay(50);
            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);
        }

        return {assetChoices_deposit, assetContracts_deposit, assetValue_deposit};
    }

    async function userWithdraw(
        signers: SignerWithAddress[], 
        product: Product,
        wMaticContract: Contract, 
        wEthContract: Contract, 
        usdcContract: Contract,
        usdPriceModule: UsdPriceModule
    ) {
        const assetChoices = [utils.wmaticAddress, utils.wethAddress, utils.usdcAddress];
        const assetContracts = [wMaticContract, wEthContract, usdcContract];

        const assetChoices_withdraw = [utils.wmaticAddress];
        const assetContracts_withdraw = [wMaticContract];
        const cnt = [100, 100, 100];

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

        for (let i=1; i<signers.length; i++) {
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

    }

    async function callRebalance() {
        const signers = await ethers.getSigners();

        const {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry,
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        } = await deployAndSetting(signers)
        
        await userDeposit(signers, product, wMaticContract, wEthContract, usdcContract, usdPriceModule, whitelistRegistry);
        for(let i=1; i<signers.length; i++) {
            expect((await product.balanceOf(signers[i].address))).above(1, "signers #" + i.toString() + " deposit error");
        }

        await product.rebalance();

        return {
            signers,
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry,
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        }
    }

    it("Usdc strategy rebalancing test",async () => {
        const {
            signers,
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            wMaticContract,
            wEthContract,
            usdcContract
        } = await loadFixture(callRebalance);

        // Check the strategy's total balance after rebalancing
        // Note: Quick token is product's underlying tokens. So quick token strategy have no tokens.
        expect(await usdcStrategy.totalAssets()).above(0, "usdc strategy balance error");
        expect(await wethStrategy.totalAssets()).above(0, "weth strategy balance error");
        expect(await wmaticStrategy.totalAssets()).above(0, "wmatic strategy balance error");
        expect(await ghstStrategy.totalAssets()).above(0, "ghst strategy balance error");
        expect(await quickStrategy.totalAssets()).equal(0, "quick is underlying asset");

        // Check the weight allocation of tokens (delta is 2%)
        expect((await product.assetValue(utils.usdcAddress)).mul(100).div(await product.portfolioValue())).closeTo(30, 2, "usdc weight error");
        expect((await product.assetValue(utils.wethAddress)).mul(100).div(await product.portfolioValue())).closeTo(20, 2, "weth weight error");
        expect((await product.assetValue(utils.wmaticAddress)).mul(100).div(await product.portfolioValue())).closeTo(40, 2, "wmatic wetight error");
        expect((await product.assetValue(utils.ghstAddress)).mul(100).div(await product.portfolioValue())).closeTo(5,  2,"ghst weight error");

        // Check the float Ratio of tokens (delta is 2%)
        expect((await usdcStrategy.totalAssets()).mul(100).div(await product.assetBalance(utils.usdcAddress))).closeTo(80, 2, "usdc float error");
        expect((await wethStrategy.totalAssets()).mul(100).div(await product.assetBalance(utils.wethAddress))).closeTo(80, 2, "weth float error");
        expect((await wmaticStrategy.totalAssets()).mul(100).div(await product.assetBalance(utils.wmaticAddress))).closeTo(80, 2, "wmatic float error");
        expect((await ghstStrategy.totalAssets()).mul(100).div(await product.assetBalance(utils.ghstAddress))).closeTo(80, 2, "ghst float error");

        await userWithdraw(signers, product, wMaticContract, wEthContract, usdcContract, usdPriceModule);
        for(let i=1; i<signers.length; i++) {
            if(await product.balanceOf(signers[i].address) != 0) {
                console.log("signers #" + i.toString() + " withdrew a smaller amount");
            }
            // expect((await product.balanceOf(signers[i].address))).equal(0, "signers #" + i.toString() + " withdraw error");
        }
    })

    it("Usdc strategy.deposit test",async () => {
        const {
            signers,
            product,
            usdcStrategy,
            usdPriceModule,
            wMaticContract,
            wEthContract,
            usdcContract,
        } = await loadFixture(callRebalance);
        
        // call strategy.desposit function
        await usdcStrategy.deposit();

        // Check the deposit logic using moo balance
        const mooUsdcContract = new ethers.Contract("0x2F4BBA9fC4F77F16829F84181eB7C8b50F639F95", utils.wEthAbi, signers[0]); // erc20(weth)
        const starUsdcContract = new ethers.Contract("0x1205f31718499dBf1fCa446663B532Ef87481fe1", utils.wEthAbi, signers[0]); // erc20(weth)

        expect(await usdcContract.balanceOf(usdcStrategy.address)).equal(0, "usdc token error")
        expect(await starUsdcContract.balanceOf(usdcStrategy.address)).equal(0, "star usdc token error")
        expect(await mooUsdcContract.balanceOf(usdcStrategy.address)).above(0, "moo usdc token error");

        await userWithdraw(signers, product, wMaticContract, wEthContract, usdcContract, usdPriceModule);

        for(let i=1; i<signers.length; i++) {
            if(await product.balanceOf(signers[i].address) != 0) {
                console.log("signers #" + i.toString() + " withdrew a smaller amount");
            }
            // expect((await product.balanceOf(signers[i].address))).equal(0, "signers #" + i.toString() + " withdraw error");
        }
    });

    it("Usdc strategy.withdrawAll test",async () => {
        const {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        } = await loadFixture(callRebalance);

        await usdcStrategy.deposit();

        // withdrawAll (emergency situation)
        await (await product.deactivateProduct()).wait();
        await (await product.emergencyWithdraw()).wait();

        expect(await wmaticStrategy.totalAssets()).equal(await wMaticContract.balanceOf(wmaticStrategy.address), "wmatic error").equal(0, "wmatic error");
        expect(await wethStrategy.totalAssets()).equal(await wEthContract.balanceOf(wethStrategy.address), "weth error").equal(0, "weth error");
        expect(await usdcStrategy.totalAssets()).equal(await usdcContract.balanceOf(usdcStrategy.address), "usdc error").equal(0, "usdc error");
        expect(await ghstStrategy.totalAssets()).equal(await ghstContract.balanceOf(ghstStrategy.address), "ghst error").equal(0, "ghst error");
        expect(await quickStrategy.totalAssets()).equal(await quickContract.balanceOf(quickStrategy.address), "quick error").equal(0, "quick error");

        expect(await product.portfolioValue()).equal(0);

    })
})

describe("Usdc strategy test with CPPI product", async () => {
    async function deployAndSetting(signers: SignerWithAddress[]) {
        const {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry
         } = await utils.deployContracts("CPPIProduct", signers[0]);
        await utils.setUsdPriceModule(signers[0], usdPriceModule);
        await utils.setCPPIProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

        const {
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        } = await utils.distributionTokens(signers);

        let floorRatio = 0.8;
        let multiplier = 1.5;
        await product.connect(signers[0]).updateRebalanceParam(floorRatio * 100000,multiplier*100000);

        await utils.activateProduct(signers[0], product, wMaticContract);
      
        await utils.setWhitelists(signers, whitelistRegistry, product.address);

        return {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry,
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        }
    }

    async function userDeposit(
        signers: SignerWithAddress[], 
        product: Product,
        wMaticContract: Contract, 
        wEthContract: Contract, 
        usdcContract: Contract,
        usdPriceModule: UsdPriceModule,
        whitelistRegistry: WhitelistRegistry
        ) {
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

        // deposit
        for (let i=1; i<signers.length; i++){
            let depositAddress = assetChoices_deposit[i];
            let depositContract = assetContracts_deposit[i];
            let depositBalance = await usdPriceModule.convertAssetBalance(depositAddress, assetValue_deposit[i]);

            await utils.delay(50);
            await utils.setWhitelists([signers[i]], whitelistRegistry, product.address);
            await depositContract.connect(signers[i]).approve(product.address, depositBalance);
            await product.connect(signers[i]).deposit(depositAddress, depositBalance, signers[i].address);
        }

        return {assetChoices_deposit, assetContracts_deposit, assetValue_deposit};
    }

    async function userWithdraw(
        signers: SignerWithAddress[], 
        product: Product,
        wMaticContract: Contract, 
        wEthContract: Contract, 
        usdcContract: Contract,
        usdPriceModule: UsdPriceModule
    ) {
        const assetChoices = [utils.wmaticAddress, utils.wethAddress, utils.usdcAddress];
        const assetContracts = [wMaticContract, wEthContract, usdcContract];

        const assetChoices_withdraw = [utils.wmaticAddress];
        const assetContracts_withdraw = [wMaticContract];
        const cnt = [100, 100, 100];

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

        for (let i=1; i<signers.length; i++) {
            let withdrawAddress = assetChoices_withdraw[i];
            let withdrawContract = assetContracts_withdraw[i];
            let beforeUserBalance = await withdrawContract.balanceOf(signers[i].address);
            let user_share = await product.balanceOf(signers[i].address);
            user_shareBalance.push((user_share).toString());
            user_estimatedWithdraw.push((await product.shareValue(user_share)).toString());

            await utils.delay(50);
            console.log("signers #", i);
            await product.connect(signers[i]).withdraw(withdrawAddress, ethers.constants.MaxUint256, signers[i].address, signers[i].address);
            let userWithdrawValue = await usdPriceModule.getAssetUsdValue(withdrawAddress, (await withdrawContract.balanceOf(signers[i].address)).sub(beforeUserBalance));

            assetValue_withdraw.push((userWithdrawValue).toString());
        }

    }

    async function callRebalance() {
        const signers = await ethers.getSigners();

        const {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry,
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        } = await deployAndSetting(signers)
        
        await userDeposit(signers, product, wMaticContract, wEthContract, usdcContract, usdPriceModule, whitelistRegistry);
        for(let i=1; i<signers.length; i++) {
            expect((await product.balanceOf(signers[i].address))).above(1, "signers #" + i.toString() + " deposit error");
        }

        await product.rebalance();

        return {
            signers,
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry,
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        }
    }

    it("Usdc strategy rebalancing test",async () => {
        const {
            signers,
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            wMaticContract,
            wEthContract,
            usdcContract
        } = await loadFixture(callRebalance);

        // Check the strategy's total balance after rebalancing
        expect(await usdcStrategy.totalAssets()).above(0, "usdc strategy balance error");
        expect(await wethStrategy.totalAssets()).above(0, "weth strategy balance error");
        expect(await wmaticStrategy.totalAssets()).above(0, "wmatic strategy balance error");
        expect(await ghstStrategy.totalAssets()).above(0, "ghst strategy balance error");
        expect(await quickStrategy.totalAssets()).above(0, "quick is underlying asset");
        
        await product.rebalance();
        
        let floorRatio = 0.8;
        let multiplier = 1.5;
        let portfolioValue = await product.portfolioValue();
        let cushion = portfolioValue.mul(10000 - floorRatio*10000).div(10000);
        let atRisk = portfolioValue.lte(cushion.mul(multiplier *10).div(10)) ? portfolioValue : cushion.mul(multiplier*10).div(10);
        let safeValue = portfolioValue.sub(atRisk);
        
        expect(await product.assetValue(utils.usdcAddress)).closeTo(safeValue, safeValue.mul(3).div(100), "usdc safe value error");
        expect((await product.assetValue(utils.wethAddress)).mul(100).div(atRisk)).closeTo(50, 2, "weth weight error");
        expect((await product.assetValue(utils.wmaticAddress)).mul(100).div(atRisk)).closeTo(40, 2, "wmatic weight error");
        expect((await product.assetValue(utils.ghstAddress)).mul(100).div(atRisk)).closeTo(5, 2, "ghst weight error");
        expect((await product.assetValue(utils.quickAddress)).mul(100).div(atRisk)).closeTo(5, 2, "quick weight error");

        // Check the float Ratio of tokens (delta is 2%)
        expect((await usdcStrategy.totalAssets()).mul(100).div(await product.assetBalance(utils.usdcAddress))).closeTo(80, 2, "usdc float error");
        expect((await wethStrategy.totalAssets()).mul(100).div(await product.assetBalance(utils.wethAddress))).closeTo(80, 2, "weth float error");
        expect((await wmaticStrategy.totalAssets()).mul(100).div(await product.assetBalance(utils.wmaticAddress))).closeTo(80, 2, "wmatic float error");
        expect((await ghstStrategy.totalAssets()).mul(100).div(await product.assetBalance(utils.ghstAddress))).closeTo(80, 2, "ghst float error");

        await userWithdraw(signers, product, wMaticContract, wEthContract, usdcContract, usdPriceModule);
        for(let i=1; i<signers.length; i++) {
            if(await product.balanceOf(signers[i].address) != 0) {
                console.log("signers #" + i.toString() + " withdrew a smaller amount");
            }
            // expect((await product.balanceOf(signers[i].address))).equal(0, "signers #" + i.toString() + " withdraw error");
        }
    })

    it.only("Usdc strategy.deposit test",async () => {
        const {
            signers,
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry,
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        } = await loadFixture(callRebalance);

        // call strategy.desposit function
        await usdcStrategy.deposit();

        // Check the deposit logic using moo balance
        const mooUsdcContract = new ethers.Contract("0x2F4BBA9fC4F77F16829F84181eB7C8b50F639F95", utils.wEthAbi, signers[0]); // erc20(weth)
        const starUsdcContract = new ethers.Contract("0x1205f31718499dBf1fCa446663B532Ef87481fe1", utils.wEthAbi, signers[0]); // erc20(weth)

        expect(await usdcContract.balanceOf(usdcStrategy.address)).equal(0, "usdc token error")
        expect(await starUsdcContract.balanceOf(usdcStrategy.address)).equal(0, "star usdc token error")
        expect(await mooUsdcContract.balanceOf(usdcStrategy.address)).above(0, "moo usdc token error");
        
        let floorRatio = 0.8;
        let multiplier = 1.5;
        let portfolioValue = await product.portfolioValue();
        let cushion = portfolioValue.mul(10000 - floorRatio*10000).div(10000);
        let atRisk = portfolioValue.lte(cushion.mul(multiplier *10).div(10)) ? portfolioValue : cushion.mul(multiplier*10).div(10);
        let safeValue = portfolioValue.sub(atRisk);
        
        expect(await product.assetValue(utils.usdcAddress)).closeTo(safeValue, safeValue.mul(3).div(100), "usdc safe value error");
        expect((await product.assetValue(utils.wethAddress)).mul(100).div(atRisk)).closeTo(50, 2, "weth weight error");
        expect((await product.assetValue(utils.wmaticAddress)).mul(100).div(atRisk)).closeTo(40, 2, "wmatic weight error");
        expect((await product.assetValue(utils.ghstAddress)).mul(100).div(atRisk)).closeTo(5, 2, "ghst weight error");
        expect((await product.assetValue(utils.quickAddress)).mul(100).div(atRisk)).closeTo(5, 2, "quick weight error");

        await userWithdraw(signers, product, wMaticContract, wEthContract, usdcContract, usdPriceModule);

        for(let i=1; i<signers.length; i++) {
            if(await product.balanceOf(signers[i].address) != 0) {
                console.log("signers #" + i.toString() + " withdrew a smaller amount");
            }
            // expect((await product.balanceOf(signers[i].address))).equal(0, "signers #" + i.toString() + " withdraw error");
        }
    });

    it("Usdc strategy.withdrawAll test",async () => {
        const {
            signers,
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry,
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        } = await loadFixture(callRebalance);

        await usdcStrategy.deposit();

        let floorRatio = 0.8;
        let multiplier = 1.5;
        let portfolioValue = await product.portfolioValue();
        let cushion = portfolioValue.mul(10000 - floorRatio*10000).div(10000);
        let atRisk = portfolioValue.lte(cushion.mul(multiplier *10).div(10)) ? portfolioValue : cushion.mul(multiplier*10).div(10);
        let safeValue = portfolioValue.sub(atRisk);
        
        expect(await product.assetValue(utils.usdcAddress)).closeTo(safeValue, safeValue.mul(3).div(100), "usdc safe value error");
        expect((await product.assetValue(utils.wethAddress)).mul(100).div(atRisk)).closeTo(50, 2, "weth weight error");
        expect((await product.assetValue(utils.wmaticAddress)).mul(100).div(atRisk)).closeTo(40, 2, "wmatic weight error");
        expect((await product.assetValue(utils.ghstAddress)).mul(100).div(atRisk)).closeTo(5, 2, "ghst weight error");
        expect((await product.assetValue(utils.quickAddress)).mul(100).div(atRisk)).closeTo(5, 2, "quick weight error");

        // withdrawAll (emergency situation)
        await (await product.deactivateProduct()).wait();
        await (await product.emergencyWithdraw()).wait();

        expect(await wmaticStrategy.totalAssets()).equal(await wMaticContract.balanceOf(wmaticStrategy.address), "wmatic error").equal(0, "wmatic error");
        expect(await wethStrategy.totalAssets()).equal(await wEthContract.balanceOf(wethStrategy.address), "weth error").equal(0, "weth error");
        expect(await usdcStrategy.totalAssets()).equal(await usdcContract.balanceOf(usdcStrategy.address), "usdc error").equal(0, "usdc error");
        expect(await ghstStrategy.totalAssets()).equal(await ghstContract.balanceOf(ghstStrategy.address), "ghst error").equal(0, "ghst error");
        expect(await quickStrategy.totalAssets()).equal(await quickContract.balanceOf(quickStrategy.address), "quick error").equal(0, "quick error");

        expect(await product.portfolioValue()).equal(0);

    })
})
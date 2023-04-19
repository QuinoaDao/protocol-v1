import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { CPPIProduct, Product, Strategy, UsdPriceModule, WhitelistRegistry } from "../typechain-types";
import { Contract } from "ethers";


describe("CPPI Product",async () => {
    let signers: SignerWithAddress[];
    let product: CPPIProduct;
    let wmaticStrategy: Strategy; // Empty
    let wethStrategy: Strategy;
    let usdcStrategy: Strategy;
    let ghstStrategy: Strategy; // Empty
    let quickStrategy: Strategy; // Empty
    let usdPriceModule: UsdPriceModule;
    let whitelistRegistry: WhitelistRegistry;
    let wMaticContract: Contract, wEthContract: Contract, usdcContract:Contract, quickContract, ghstContract, swapContract

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

        for(let i=0; i<signers.length; i++) {
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

        for(let i=0; i<signers.length; i++) {
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
    
    
    beforeEach("Contract Configuation", async() => {
        signers = await ethers.getSigners();

        ({
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry
         } = await utils.deployContracts("CPPIProduct", signers[0]));
        
        await utils.setUsdPriceModule(signers[0], usdPriceModule);

        await utils.setCPPIProductWithAllStrategies(signers[0], product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);
        ({
            wMaticContract,
            wEthContract,
            usdcContract,
            quickContract,
            ghstContract,
            swapContract
        } = await utils.distributionTokens(signers));

        await product.connect(signers[0]).updateRebalanceParam(60000, 2);
        // await utils.activateProduct(signers[0], product, wMaticContract);
    })

    it("should have a floor ratio", async () => {
        const floorRatio: BigNumber = await product.floorRatio();
        expect(floorRatio.gt(BigNumber.from(0))).to.be.true;
    })

    it("should have a multiplier", async () => {
        const multiplier: BigNumber = await product.multiplier();
        expect(multiplier.gt(BigNumber.from(0))).to.be.true;    
    })

    it("should update rebalance parameters correctly", async () => {
        const newFloorRatio = 50000;
        const newMultiplier = 2;
        await product.updateRebalanceParam(newFloorRatio, newMultiplier);
        expect(await product.floorRatio()).to.equal(newFloorRatio);
        expect(await product.multiplier()).to.equal(newMultiplier);
    });

    it("should revert if newFloorRatio or newMultiplier is out of range", async function () {
        expect(product.updateRebalanceParam(100001, 1)).to.be.revertedWith("OutOfRange");
        expect(product.updateRebalanceParam(50000, -1)).to.be.revertedWith("OutOfRange");
        expect(product.updateRebalanceParam(-1, 2)).to.be.revertedWith("OutOfRange");
    });

    it("should revert if caller is not the DAC", async function () {
        expect(product.connect(signers[1]).updateRebalanceParam(50000, 1)).to.be.revertedWith("Only dac can access");
    });

    it("should be able to activate", async () => {
        await utils.activateProduct(signers[0], product, wMaticContract);
        expect(await product.checkActivation()).to.be.true;
    })

    it("should be equal between dac deposit value and portfolio initial value", async () => {
        await utils.activateProduct(signers[0], product, wMaticContract);
        let dacInitialDepositValue = await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, parseEther("200"));
        let productInitialShareBalance = await product.totalSupply();
        let productInitialPortfolioValue = await product.portfolioValue();
        let productInitialWmaticBalance = await product.assetBalance(utils.wmaticAddress);
        expect(dacInitialDepositValue).equal(productInitialPortfolioValue);
    })

    it('should revert if called by an unauthorized account', async function () {
        expect(product.connect(signers[1]).rebalance()).to.be.revertedWith("Access Not allowed");
    });

    // it("should rebalance", async () => {
    //     await utils.setWhitelists(signers, whitelistRegistry, product.address);

    //     const floorRatio = 0.6;
    //     const multiplier = 2;
    //     await product.connect(signers[0]).updateRebalanceParam(floorRatio * 100000,multiplier);
    //     await utils.activateProduct(signers[0], product, wMaticContract);
        
    //     await userDeposit(signers, product, wMaticContract, wEthContract, usdcContract, usdPriceModule, whitelistRegistry);
    //     for(let i=1; i<signers.length; i++) {
    //         expect((await product.balanceOf(signers[i].address))).above(1, "signers #" + i.toString() + " deposit error");
    //     }
    //     await product.rebalance();
        
    //     let portfolioValue = await product.portfolioValue();
    //     let cushion = portfolioValue.mul(10000 - floorRatio*10000).div(10000);
    //     let atRisk = portfolioValue.lte(cushion.mul(multiplier)) ? portfolioValue : cushion.mul(multiplier);
    //     let safeValue = portfolioValue.sub(atRisk);

    //     expect(await product.assetValue(utils.usdcAddress)).closeTo(safeValue, 2, "usdc safe value error");
    //     expect((await product.assetValue(utils.wethAddress)).mul(100).div(atRisk)).closeTo(50, 2, "weth weight error");
    //     expect((await product.assetValue(utils.wmaticAddress)).mul(100).div(atRisk)).closeTo(40, 2, "wmatic weight error");
    //     expect((await product.assetValue(utils.ghstAddress)).mul(100).div(atRisk)).closeTo(5, 2, "ghst weight error");
    //     expect((await product.assetValue(utils.quickAddress)).mul(100).div(atRisk)).closeTo(5, 2, "quick weight error");

    //     await userWithdraw(signers, product, wMaticContract, wEthContract, usdcContract, usdPriceModule);

    //     for(let i=1; i<signers.length; i++) {
    //         expect((await product.balanceOf(signers[i].address))).equal(0, "signers #" + i.toString() + " withdraw error");
    //     }
    // })
    it("should multiple rebalanced", async () => {
        await utils.setWhitelists(signers, whitelistRegistry, product.address);

        const floorRatio = 0.6;
        const multiplier = 2;
        await product.connect(signers[0]).updateRebalanceParam(floorRatio * 100000,multiplier);
        await utils.activateProduct(signers[0], product, wMaticContract);
        
        await userDeposit(signers, product, wMaticContract, wEthContract, usdcContract, usdPriceModule, whitelistRegistry);
        for(let i=1; i<signers.length; i++) {
            expect((await product.balanceOf(signers[i].address))).above(1, "signers #" + i.toString() + " deposit error");
        }
        await product.rebalance();
        
        let portfolioValue = await product.portfolioValue();
        let cushion = portfolioValue.mul(10000 - floorRatio*10000).div(10000);
        let atRisk = portfolioValue.lte(cushion.mul(multiplier)) ? portfolioValue : cushion.mul(multiplier);
        let safeValue = portfolioValue.sub(atRisk);
        
        await product.rebalance();
        
        expect(await product.assetValue(utils.usdcAddress)).closeTo(safeValue, 2, "usdc safe value error");
        expect((await product.assetValue(utils.wethAddress)).mul(100).div(atRisk)).closeTo(50, 2, "weth weight error");
        expect((await product.assetValue(utils.wmaticAddress)).mul(100).div(atRisk)).closeTo(40, 2, "wmatic weight error");
        expect((await product.assetValue(utils.ghstAddress)).mul(100).div(atRisk)).closeTo(5, 2, "ghst weight error");
        expect((await product.assetValue(utils.quickAddress)).mul(100).div(atRisk)).closeTo(5, 2, "quick weight error");
        
        await userWithdraw(signers, product, wMaticContract, wEthContract, usdcContract, usdPriceModule);
        
        for(let i=1; i<signers.length; i++) {
            expect((await product.balanceOf(signers[i].address))).equal(0, "signers #" + i.toString() + " withdraw error");
        }
    })
})
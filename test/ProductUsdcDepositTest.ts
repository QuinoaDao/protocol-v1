import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect, util } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";

describe('usdc in test',async () => {
    it('usdc in - usdc out test',async () => {
        const [dac, nonDac] = await ethers.getSigners();
        const {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry
        } = await utils.deployContracts(dac);
        await utils.setUsdPriceModule(dac, usdPriceModule);
        await utils.setProductWithAllStrategy(dac, product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

        const {
            wMaticContract,
            usdcContract,
          } = await utils.distributionTokens([dac, nonDac]);
        await utils.activateProduct(dac, product, wMaticContract);
      
        // usdc로 100 deposit -> nonDac
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        expect(product.connect(nonDac).deposit(utils.usdcAddress, parseUnits("50", 6), nonDac.address)).revertedWith("You're not in whitelist");

        await utils.setWhitelists([nonDac], whitelistRegistry, product.address);

        await product.connect(nonDac).deposit(utils.usdcAddress, parseUnits("50", 6), nonDac.address);
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(utils.usdcAddress, parseUnits("50", 6), nonDac.address);
      
        // portfolio의 잔액 확인
        console.log("portfolio value: ", await product.portfolioValue());
        console.log("product usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product wmatic balance: ", await product.assetFloatBalance(utils.wmaticAddress));
      
        // user의 share token 잔액 확인
        console.log("nonDac's deposit value: ", await usdPriceModule.getAssetUsdValue(utils.usdcAddress, parseUnits("100", 6)));
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 절반 usdc로 out
        let nonDacShareBalance = await product.balanceOf(nonDac.address);
        await product.connect(nonDac).withdraw(utils.usdcAddress, nonDacShareBalance.div(2), nonDac.address, nonDac.address);

        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));

        // 절반 usdc로 out
        await product.connect(nonDac).withdraw(utils.usdcAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
        
        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");
        
        console.log("product's total portfolio: ", await product.portfolioValue());

    })

    it('usdc in - weth out test',async () => {
        const [dac, nonDac] = await ethers.getSigners();
        const {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry
        } = await utils.deployContracts(dac);
        await utils.setUsdPriceModule(dac, usdPriceModule);
        await utils.setProductWithAllStrategy(dac, product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

        const {
            wMaticContract,
            wEthContract,
            usdcContract,
            swapContract
          } = await utils.distributionTokens([dac, nonDac]);
        await utils.activateProduct(dac, product, wMaticContract);
      
        // usdc로 100 deposit -> nonDac
        await utils.setWhitelists([nonDac], whitelistRegistry, product.address);

        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(utils.usdcAddress, parseUnits("50", 6), nonDac.address);
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(utils.usdcAddress, parseUnits("50", 6), nonDac.address);
      
        // portfolio의 잔액 확인
        console.log("portfolio value: ", await product.portfolioValue());
        console.log("product usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product wmatic balance: ", await product.assetFloatBalance(utils.wmaticAddress));
      
        // user의 share token 잔액 확인
        console.log("nonDac's deposit value: ", await usdPriceModule.getAssetUsdValue(utils.usdcAddress, parseUnits("100", 6)));
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 절반 weth으로 out
        let nonDacShareBalance = await product.balanceOf(nonDac.address);
        await product.connect(nonDac).withdraw(utils.wethAddress, nonDacShareBalance.div(2), nonDac.address, nonDac.address);

        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));

        // 절반 weth으로 out
        await product.connect(nonDac).withdraw(utils.wethAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
        
        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");
        
        console.log("product's total wmatic balance: ", await product.assetBalance(utils.wmaticAddress));
        console.log("product's total weth balance: ", await product.assetBalance(utils.wethAddress));
        console.log("product's total usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product's total portfolio value: ", await product.portfolioValue());
        console.log("user's total withdrawal value: ", await usdPriceModule.getAssetUsdValue(utils.wethAddress, "59924353490344731"));
    })

    it('usdc in - wmatic out test',async () => {
        const [dac, nonDac] = await ethers.getSigners();
        const {
            product,
            wmaticStrategy,
            wethStrategy,
            usdcStrategy,
            ghstStrategy,
            quickStrategy,
            usdPriceModule,
            whitelistRegistry
        } = await utils.deployContracts(dac);
        await utils.setUsdPriceModule(dac, usdPriceModule);
        await utils.setProductWithAllStrategy(dac, product, wmaticStrategy, wethStrategy, ghstStrategy, quickStrategy, usdcStrategy);

        const {
            wMaticContract,
            usdcContract,
          } = await utils.distributionTokens([dac, nonDac]);
        await utils.activateProduct(dac, product, wMaticContract);
      
        // usdc로 100 deposit -> nonDac
        await utils.setWhitelists([nonDac], whitelistRegistry, product.address);
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(utils.usdcAddress, parseUnits("50", 6), nonDac.address);
        await usdcContract.connect(nonDac).approve(product.address, parseUnits("50", 6));
        await product.connect(nonDac).deposit(utils.usdcAddress, parseUnits("50", 6), nonDac.address);
      
        // portfolio의 잔액 확인
        console.log("portfolio value: ", await product.portfolioValue());
        console.log("product usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product wmatic balance: ", await product.assetFloatBalance(utils.wmaticAddress));
      
        // user의 share token 잔액 확인
        console.log("nonDac's deposit value: ", await usdPriceModule.getAssetUsdValue(utils.usdcAddress, parseUnits("100", 6)));
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 절반 wmatic으로 out
        let nonDacShareBalance = await product.balanceOf(nonDac.address);
        let nonDacWmaticBalance = await wMaticContract.balanceOf(nonDac.address);
        await product.connect(nonDac).withdraw(utils.wmaticAddress, nonDacShareBalance.div(2), nonDac.address, nonDac.address);

        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 절반 wmatic으로 out
        await product.connect(nonDac).withdraw(utils.wmaticAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
        
        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");
        
        console.log("product's total wmatic balance: ", await product.assetBalance(utils.wmaticAddress));
        console.log("product's total weth balance: ", await product.assetBalance(utils.wethAddress));
        console.log("product's total usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product's total portfolio value: ", await product.portfolioValue());
        console.log("user's total withdrawal value: ", await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, (await wMaticContract.balanceOf(nonDac.address)).sub(nonDacWmaticBalance)));
    })

})


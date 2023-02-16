import * as utils from "./utils";
import { ethers } from "hardhat";
import { expect, util } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";

describe('weth in test',async () => {
    it('weth in - weth out',async () => {
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
      
        // weth로 0.1 weth deposit -> nonDac
        await utils.setWhitelists([nonDac], whitelistRegistry, product.address);

        await wEthContract.connect(nonDac).approve(product.address, parseUnits("1", 17));
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
      
        // portfolio의 잔액 확인
        console.log("portfolio value: ", await product.portfolioValue());
        console.log("product usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product wmatic balance: ", await product.assetFloatBalance(utils.wmaticAddress));
        console.log("product weth balance: ", await product.assetFloatBalance(utils.wethAddress));

        // user의 share token 잔액 확인
        console.log("nonDac's deposit value: ", await usdPriceModule.getAssetUsdValue(utils.wethAddress, parseUnits("1", 17)));
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 절반 weth로 out
        let nonDacShareBalance = await product.balanceOf(nonDac.address);
        let nonDacWethBalance = await wEthContract.balanceOf(nonDac.address);
        await product.connect(nonDac).withdraw(utils.wethAddress, nonDacShareBalance.div(2), nonDac.address, nonDac.address);

        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        // 절반 weth로 out
        await product.connect(nonDac).withdraw(utils.wethAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);
        
        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        console.log("product's total wmatic balance: ", await product.assetBalance(utils.wmaticAddress));
        console.log("product's total weth balance: ", await product.assetBalance(utils.wethAddress));
        console.log("product's total usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product's total portfolio value: ", await product.portfolioValue());
        console.log("user's total withdrawal value: ", await usdPriceModule.getAssetUsdValue(utils.wethAddress, (await wEthContract.balanceOf(nonDac.address)).sub(nonDacWethBalance)));
    })

    it('weth in - usdc out',async () => {
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
      
        await utils.setWhitelists([nonDac], whitelistRegistry, product.address);

        // weth로 0.1 weth deposit -> nonDac
        await wEthContract.connect(nonDac).approve(product.address, parseUnits("2", 17));
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
      
        // portfolio의 잔액 확인
        console.log("portfolio value: ", await product.portfolioValue());
        console.log("product usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product wmatic balance: ", await product.assetFloatBalance(utils.wmaticAddress));
        console.log("product weth balance: ", await product.assetFloatBalance(utils.wethAddress));

        // user의 share token 잔액 확인
        console.log("nonDac's deposit value: ", await usdPriceModule.getAssetUsdValue(utils.wethAddress, parseUnits("1", 17)));
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 전부 usdc로 out
        let nonDacShareBalance = await product.balanceOf(nonDac.address);
        let nonDacUsdcBalance = await usdcContract.balanceOf(nonDac.address);
        await product.connect(nonDac).withdraw(utils.usdcAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);

        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));


        console.log("------------------------------------------------------------------------");

        console.log("product's total usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product's total weth balance: ", await product.assetBalance(utils.wethAddress));
        console.log("product's total usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product's total portfolio value: ", await product.portfolioValue());
        console.log("user's total withdrawal value: ", await usdPriceModule.getAssetUsdValue(utils.usdcAddress, (await usdcContract.balanceOf(nonDac.address)).sub(nonDacUsdcBalance)));
    })

    it('weth in - wamtic out',async () => {
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
      
        // weth로 0.1 weth deposit -> nonDac
        await utils.setWhitelists([nonDac], whitelistRegistry, product.address);

        await wEthContract.connect(nonDac).approve(product.address, parseUnits("2", 17));
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
        await product.connect(nonDac).deposit(utils.wethAddress, parseUnits("25", 15), nonDac.address);
      
        // portfolio의 잔액 확인
        console.log("portfolio value: ", await product.portfolioValue());
        console.log("product usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product wmatic balance: ", await product.assetFloatBalance(utils.wmaticAddress));
        console.log("product weth balance: ", await product.assetFloatBalance(utils.wethAddress));

        // user의 share token 잔액 확인
        console.log("nonDac's deposit value: ", await usdPriceModule.getAssetUsdValue(utils.wethAddress, parseUnits("1", 17)));
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));

        console.log("------------------------------------------------------------------------");

        // 전부 wmatic으로 out
        let nonDacShareBalance = await product.balanceOf(nonDac.address);
        let nonDacWmaticBalance = await wMaticContract.balanceOf(nonDac.address);
        await product.connect(nonDac).withdraw(utils.wmaticAddress, ethers.constants.MaxUint256, nonDac.address, nonDac.address);

        // user의 share token 잔액 확인
        console.log("nonDac's share balance: ", await product.balanceOf(nonDac.address));
        console.log("nonDac's usdc balance: ", await usdcContract.balanceOf(nonDac.address));
        console.log("nonDac's weth balance: ", await wEthContract.balanceOf(nonDac.address));
        console.log("nonDac's wmatic balance: ", await wMaticContract.balanceOf(nonDac.address));


        console.log("------------------------------------------------------------------------");

        console.log("product's total wmatic balance: ", await product.assetBalance(utils.wmaticAddress));
        console.log("product's total weth balance: ", await product.assetBalance(utils.wethAddress));
        console.log("product's total usdc balance: ", await product.assetBalance(utils.usdcAddress));
        console.log("product's total portfolio value: ", await product.portfolioValue());
        console.log("user's total withdrawal value: ", await usdPriceModule.getAssetUsdValue(utils.wmaticAddress, (await wMaticContract.balanceOf(nonDac.address)).sub(nonDacWmaticBalance)));
    })
})
import { ethers } from "hardhat";
import { abi as productAbi} from "../artifacts/contracts/Product.sol/Product.json";


import {abi as erc20Abi} from "../artifacts/contracts/test/TestToken.sol/TestToken.json";
import {abi as usdcAbi} from "../artifacts/contracts/test/TestUsdc.sol/TestUsdc.json";
import quickFactoryAbi from "../abis/quickSwapFactoryABI.json";
import quickRouterAbi from "../abis/quickSwapRouterABI.json";
import { parseEther, parseUnits } from "ethers/lib/utils";

const wmaticAddress = "0x960aa55843Dd52E3bb8B8854593567c84134b832";
const wethAddress = "0x81347Dd8CB2Fb3857153cE023f70021a4B644f32";
const linkAddress = "0x26D7873C8E599412882f2628Ce7fb96d7db47FF7";
const usdcAddress = "0xC76B6A113BF7eE9e7976339eE4d9F34C32f0419c";

const wmaticStrategyAddress = "0x57E066059433AAc9cAB5C02da2c2a0509bdBD742";
const wethStrategyAddress = "0x079786b828509196a2bc1Dc36806E0F4943Ad405";
const linkStrategyAddress = "0xdA2cECCb33bff08Eb9e59aa1a8343c9f1711435c";
const usdcStrategyAddress = "0xde53461CE153c8623ffcCAFbBdf2FBdD850abD40";

const productAddress = "0x403dE1fEB06b9259937f5929fa4b31008145B3F5";
const usdPriceModuleAddress = "0x3E8329165C5286FefCe4af9794de4c6A57067B1e";

const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

async function main(){
    const [dac, nonDac] = await ethers.getSigners();

    const wmaticContract = new ethers.Contract(wmaticAddress, erc20Abi, dac);
    const wethContract = new ethers.Contract(wethAddress, erc20Abi, dac);
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, dac);
    const linkContract = new ethers.Contract(linkAddress, erc20Abi, dac);

    const product = new ethers.Contract(productAddress, productAbi, dac);

    const swapRouterContract = new ethers.Contract(quickSwapRouter, quickRouterAbi, dac);
    const swapFactoryContract = new ethers.Contract(quickSwapFactory, quickFactoryAbi, dac);

    /**
     * 0. 토큰 balance들 확인 코드들
     */
    // console.log("dac test wmaitc balance:" ,(await wmaticContract.balanceOf(dac.address)).toString());
    // console.log("dac test weth balance: ", (await wethContract.balanceOf(dac.address)).toString());
    // console.log("dac test usdc balance: ", (await usdcContract.balanceOf(dac.address)).toString());
    // console.log("dac test link balance: ", (await linkContract.balanceOf(dac.address)).toString());

    // console.log("product portfolio value: ", (await product.portfolioValue()).toString());
    // console.log("product wmatic balance / value: ", (await product.assetBalance(wmaticAddress)).toString(), (await product.assetValue(wmaticAddress)).toString());
    // console.log("product weth balance / value: ", (await product.assetBalance(wethAddress)).toString(), (await product.assetValue(wethAddress)).toString());
    // console.log("product link balance / value: ", (await product.assetBalance(linkAddress)).toString(), (await product.assetValue(linkAddress)).toString());
    // console.log("product usdc balance / value: ", (await product.assetBalance(usdcAddress)).toString(), (await product.assetValue(usdcAddress)).toString());
    
    // console.log("user share token: ", (await product.balanceOf(dac.address)).toString());

    // console.log("wmatic balance: ", (await wmaticContract.balanceOf(dac.address)).toString());
    // console.log("weth balance: ", (await wethContract.balanceOf(dac.address)).toString());
    // console.log("link balance: ", (await linkContract.balanceOf(dac.address)).toString());
    // console.log("usdc balance: ", (await usdcContract.balanceOf(dac.address)).toString());

    // console.log("wmatic allowance: ", (await wmaticContract.allowance(dac.address, quickSwapRouter)).toString());
    // console.log("weth allowance: ", (await wethContract.allowance(dac.address, quickSwapRouter)).toString());
    // console.log("link allowance: ", (await linkContract.allowance(dac.address, quickSwapRouter)).toString());
    // console.log("usdc allowance: ", (await usdcContract.allowance(dac.address, quickSwapRouter)).toString());


    /**
     * 1. 토큰 pair 생성
     */
    await (await swapFactoryContract.createPair(usdcAddress, wmaticAddress)).wait();
    await (await swapFactoryContract.createPair(usdcAddress, wethAddress)).wait();
    await (await swapFactoryContract.createPair(usdcAddress, linkAddress)).wait();
    await (await swapFactoryContract.createPair(wmaticAddress, wethAddress)).wait();
    await (await swapFactoryContract.createPair(wmaticAddress, linkAddress)).wait();
    await (await swapFactoryContract.createPair(wethAddress, linkAddress)).wait();

    /**
     * 2. liquidity 추가
     */
    await (await wethContract.mint(dac.address, parseEther("10000000000"))).wait();
    await (await wmaticContract.mint(dac.address, parseEther("10000000000"))).wait();
    await (await linkContract.mint(dac.address, parseEther("10000000000"))).wait();
    await (await usdcContract.mint(dac.address, parseUnits("10000000000", 6))).wait();

    await (await wethContract.approve(quickSwapRouter, parseEther("10000000000"))).wait();
    await (await wmaticContract.approve(quickSwapRouter, parseEther("10000000000"))).wait();
    await (await linkContract.approve(quickSwapRouter,  parseEther("10000000000"))).wait();
    await (await usdcContract.approve(quickSwapRouter, parseUnits("10000000000", 6))).wait();
    
    console.log("wmatic allowance: ", (await wmaticContract.allowance(dac.address, quickSwapRouter)).toString());
    console.log("weth allowance: ", (await wethContract.allowance(dac.address, quickSwapRouter)).toString());
    console.log("link allowance: ", (await linkContract.allowance(dac.address, quickSwapRouter)).toString());
    console.log("usdc allowance: ", (await usdcContract.allowance(dac.address, quickSwapRouter)).toString());

    let amountADesired = parseEther("87");
    let amountBDesired = parseUnits("100000", 18)
    let deadline = Date.now() + 10000*60;

    await (await swapRouterContract.connect(dac).addLiquidity(
        wethAddress, 
        wmaticAddress, 
        amountADesired,
        amountBDesired,
        amountADesired,
        amountBDesired,
        dac.address,
        deadline,
    )).wait();

    /**
     * 3. token deposit 수행
     */
    console.log("deposit wmatic");
    await (await wmaticContract.approve(product.address, parseEther("100"))).wait();
    await (await product.deposit(wmaticAddress, parseEther("100"), dac.address)).wait();
    console.log("success!");
    console.log("deposit weth");
    await (await wethContract.approve(product.address, parseEther("10"))).wait();
    await (await product.deposit(wethAddress, parseEther("10"), dac.address)).wait();
    console.log("success!");
    console.log("deposit usdc");
    await (await usdcContract.approve(product.address, parseUnits("100", 6))).wait();
    await (await product.deposit(usdcAddress, parseUnits("100", 6), dac.address)).wait();
    console.log("success!");
    console.log("deposit link");
    await (await linkContract.approve(product.address, parseEther("1000"))).wait();
    await (await product.deposit(linkAddress, parseEther("1000"), dac.address)).wait();
    console.log("success!");

    console.log("product portfolio value: ", (await product.portfolioValue()).toString());
    console.log("product wmatic balance / value: ", (await product.assetBalance(wmaticAddress)).toString(), (await product.assetValue(wmaticAddress)).toString());
    console.log("product weth balance / value: ", (await product.assetBalance(wethAddress)).toString(), (await product.assetValue(wethAddress)).toString());
    console.log("product link balance / value: ", (await product.assetBalance(linkAddress)).toString(), (await product.assetValue(linkAddress)).toString());
    console.log("product usdc balance / value: ", (await product.assetBalance(usdcAddress)).toString(), (await product.assetValue(usdcAddress)).toString());
    
    console.log("user share token: ", (await product.balanceOf(dac.address)).toString());


    /**
     * 4. rebalance 호출 확인
     */

    let estimatedGas = await product.estimateGas.rebalance();
    console.log("call rebalancing with link token deposit");
    console.log("estimated gas limit: ", estimatedGas);
    await (await product.rebalance({gasLimit: estimatedGas})).wait();

    console.log("product portfolio value: ", (await product.portfolioValue()).toString());
    console.log("product wmatic balance / value: ", (await product.assetBalance(wmaticAddress)).toString(), (await product.assetValue(wmaticAddress)).toString());
    console.log("product weth balance / value: ", (await product.assetBalance(wethAddress)).toString(), (await product.assetValue(wethAddress)).toString());
    console.log("product link balance / value: ", (await product.assetBalance(linkAddress)).toString(), (await product.assetValue(linkAddress)).toString());
    console.log("product usdc balance / value: ", (await product.assetBalance(usdcAddress)).toString(), (await product.assetValue(usdcAddress)).toString());
    
    console.log("user share token: ", (await product.balanceOf(dac.address)).toString());

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

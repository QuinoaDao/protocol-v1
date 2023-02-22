import { ethers } from "hardhat";
import { abi as productAbi} from "../artifacts/contracts/TestProduct.sol/TestProduct.json";
import { abi as usdPriceModuleAbi} from "../artifacts/contracts/IUsdPriceModule.sol/IUsdPriceModule.json";


import {abi as erc20Abi} from "../artifacts/contracts/test/TestToken.sol/TestToken.json";
import {abi as usdcAbi} from "../artifacts/contracts/test/TestUsdc.sol/TestUsdc.json";
import quickFactoryAbi from "../abis/quickSwapFactoryABI.json";
import quickRouterAbi from "../abis/quickSwapRouterABI.json";
import quickPairAbi from "../abis/quickSwapV2PairABI.json";
import { parseEther, parseUnits} from "ethers/lib/utils";
import { BigNumber } from "ethers";

const wmaticAddress = "0xA63711eDBFdCC759B79e35e01E6542585250238B";
const wethAddress = "0xc8342E0E8eDB21D980891A234e3Bda2840c40E6D";
const linkAddress = "0xb8E07dc3f46d3Eb6865D519372215D45279540b8";
const usdcAddress = "0xba2D7ED6237224991067c739623C6AA040aDec26";

const wmaticStrategyAddress = "0x3AE77cd7C90761643d28252de5Ff3E5ED9090E17";
const wethStrategyAddress = "0xEf4F456a44fF38791AB4E913A716d517Cc6d366f";
const linkStrategyAddress = "0xBA911F20C56A76f6E2f708d6C7aAA168E327ede9";
const usdcStrategyAddress = "0x977f7a9332aBfe32948E0c820E1024691F893cef";

const productAddress = "0x861B43b21b2E9D23A296745aE543c5AF2e9bEA37";
const usdPriceModuleAddress = "0xEBfFfF63D2f8cbe6ddA1DC8d296C4d9A53FdAa47";

const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const quickSwapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const wmaticOracle = "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada";
const wethOracle = "0x0715A7794a1dc8e42615F059dD6e406A6594651A";
const linkOracle = "0x1C2252aeeD50e0c9B64bDfF2735Ee3C932F5C408"; 
const usdcOracle = "0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0";

async function main(){
    const [dac, nonDac] = await ethers.getSigners();
    const wmaticContract = new ethers.Contract(wmaticAddress, erc20Abi, dac);
    const wethContract = new ethers.Contract(wethAddress, erc20Abi, dac);
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, dac);
    const linkContract = new ethers.Contract(linkAddress, erc20Abi, dac);
    
    const product = new ethers.Contract(productAddress, productAbi, dac);
    const usdPriceModule = new ethers.Contract(usdPriceModuleAddress, usdPriceModuleAbi, dac);

    const swapRouterContract = new ethers.Contract(quickSwapRouter, quickRouterAbi, dac);
    const swapFactoryContract = new ethers.Contract(quickSwapFactory, quickFactoryAbi, dac);

    const pair_weth_wmatic = new ethers.Contract(await swapFactoryContract.getPair(wmaticAddress,wethAddress), quickPairAbi, dac);
    const pair_link_wmatic = new ethers.Contract(await swapFactoryContract.getPair(wmaticAddress,linkAddress), quickPairAbi, dac);
    const pair_weth_link = new ethers.Contract(await swapFactoryContract.getPair(linkAddress,wethAddress), quickPairAbi, dac);
    const pair_wmatic_usdc = new ethers.Contract(await swapFactoryContract.getPair(usdcAddress,wmaticAddress), quickPairAbi, dac);
    const pair_link_usdc = new ethers.Contract(await swapFactoryContract.getPair(usdcAddress,linkAddress), quickPairAbi, dac);
    const pair_weth_usdc = new ethers.Contract(await swapFactoryContract.getPair(usdcAddress,wethAddress), quickPairAbi, dac);
    /**
     * 0. 토큰 balance들 확인 코드들
     */
    console.log("dac test wmaitc balance:" ,(await wmaticContract.balanceOf(dac.address)).toString());
    console.log("dac test weth balance: ", (await wethContract.balanceOf(dac.address)).toString());
    console.log("dac test usdc balance: ", (await usdcContract.balanceOf(dac.address)).toString());
    console.log("dac test link balance: ", (await linkContract.balanceOf(dac.address)).toString());

    console.log("product portfolio value: ", (await product.portfolioValue()).toString());
    console.log("product wmatic balance / value: ", (await product.assetBalance(wmaticAddress)).toString(), (await product.assetValue(wmaticAddress)).toString());
    console.log("product weth balance / value: ", (await product.assetBalance(wethAddress)).toString(), (await product.assetValue(wethAddress)).toString());
    console.log("product link balance / value: ", (await product.assetBalance(linkAddress)).toString(), (await product.assetValue(linkAddress)).toString());
    console.log("product usdc balance / value: ", (await product.assetBalance(usdcAddress)).toString(), (await product.assetValue(usdcAddress)).toString());
    
    console.log("user share token: ", (await product.balanceOf(dac.address)).toString());

    console.log("wmatic balance: ", (await wmaticContract.balanceOf(dac.address)).toString());
    console.log("weth balance: ", (await wethContract.balanceOf(dac.address)).toString());
    console.log("link balance: ", (await linkContract.balanceOf(dac.address)).toString());
    console.log("usdc balance: ", (await usdcContract.balanceOf(dac.address)).toString());

    console.log("wmatic allowance: ", (await wmaticContract.allowance(dac.address, quickSwapRouter)).toString());
    console.log("weth allowance: ", (await wethContract.allowance(dac.address, quickSwapRouter)).toString());
    console.log("link allowance: ", (await linkContract.allowance(dac.address, quickSwapRouter)).toString());
    console.log("usdc allowance: ", (await usdcContract.allowance(dac.address, quickSwapRouter)).toString());


    // /**
    //  * 1. 토큰 pair 생성
    //  */
    // await (await swapFactoryContract.createPair(usdcAddress, wmaticAddress)).wait();
    // await (await swapFactoryContract.createPair(usdcAddress, wethAddress)).wait();
    // await (await swapFactoryContract.createPair(usdcAddress, linkAddress)).wait();
    // await (await swapFactoryContract.createPair(wmaticAddress, wethAddress)).wait();
    // await (await swapFactoryContract.createPair(wmaticAddress, linkAddress)).wait();
    // await (await swapFactoryContract.createPair(wethAddress, linkAddress)).wait();

    /**
     * 2. liquidity 추가
     */

    // await (await wethContract.mint(dac.address, parseEther("10000000000"))).wait();
    // await (await wmaticContract.mint(dac.address, parseEther("10000000000"))).wait();
    // await (await linkContract.mint(dac.address, parseEther("10000000000"))).wait();
    // await (await usdcContract.mint(dac.address, parseUnits("10000000000", 6))).wait();

    // await (await wethContract.approve(quickSwapRouter, parseEther("10000000000"))).wait();
    // await (await wmaticContract.approve(quickSwapRouter, parseEther("10000000000"))).wait();
    // await (await linkContract.approve(quickSwapRouter,  parseEther("10000000000"))).wait();
    // await (await usdcContract.approve(quickSwapRouter, parseUnits("10000000000", 6))).wait();
    
    console.log("wmatic allowance: ", (await wmaticContract.allowance(dac.address, quickSwapRouter)).toString());
    console.log("weth allowance: ", (await wethContract.allowance(dac.address, quickSwapRouter)).toString());
    console.log("link allowance: ", (await linkContract.allowance(dac.address, quickSwapRouter)).toString());
    console.log("usdc allowance: ", (await usdcContract.allowance(dac.address, quickSwapRouter)).toString());

    const ethPrice: BigNumber = await usdPriceModule.getAssetUsdPrice(wethAddress);
    const maticPrice: BigNumber = await usdPriceModule.getAssetUsdPrice(wmaticAddress);
    const linkPrice: BigNumber = await usdPriceModule.getAssetUsdPrice(linkAddress);

    const amountUSDCConstant = BigNumber.from("10000000");
    const amountWETHConstant = BigNumber.from("10000000");
    const amountWMATICConstant = BigNumber.from("10000000");
    console.log(ethPrice);
    console.log(ethPrice.mul(amountUSDCConstant));
    console.log(amountUSDCConstant.div(ethPrice));
    const amountWethUSDC = parseUnits((amountUSDCConstant.div(ethPrice)).toString(), 18); 
    const amountWmaticUSDC = parseUnits((amountUSDCConstant.div(maticPrice)).toString(), 18);
    const amountLinkUSDC = parseUnits((amountUSDCConstant.div(linkPrice)).toString(), 18);
    const amountWMATICWETH = parseUnits(((ethPrice.div(maticPrice)).mul(amountWETHConstant)).toString(), 18);
    const amountLinkWETH = parseUnits(((ethPrice.div(linkPrice)).mul(amountWETHConstant)).toString(), 18);
    const amountLinkWMATIC = parseUnits(((maticPrice.div(linkPrice)).mul(amountWMATICConstant)).toString(), 18);

    console.log(amountWethUSDC, amountWmaticUSDC, amountLinkUSDC, amountWMATICWETH, amountLinkWETH, amountLinkWMATIC);
    
    // let deadline = Date.now() + 10000*60;

    // await (await swapRouterContract.connect(dac).addLiquidity(
    //     wethAddress, 
    //     usdcAddress, 
    //     amountWethUSDC,
    //     amountUSDCConstant,
    //     amountWethUSDC,
    //     amountUSDCConstant,
    //     dac.address,
    //     deadline,
    // )).wait();
    // await (await swapRouterContract.connect(dac).addLiquidity(
    //     wmaticAddress, 
    //     usdcAddress, 
    //     amountWmaticUSDC,
    //     amountUSDCConstant,
    //     amountWmaticUSDC,
    //     amountUSDCConstant,
    //     dac.address,
    //     deadline,
    // )).wait();
    // await (await swapRouterContract.connect(dac).addLiquidity(
    //     linkAddress, 
    //     usdcAddress, 
    //     amountLinkUSDC,
    //     amountUSDCConstant,
    //     amountLinkUSDC,
    //     amountUSDCConstant,
    //     dac.address,
    //     deadline,
    // )).wait();
    // await (await swapRouterContract.connect(dac).addLiquidity(
    //     wmaticAddress, 
    //     wethAddress, 
    //     amountWMATICWETH,
    //     amountWETHConstant,
    //     amountWMATICWETH,
    //     amountWETHConstant,
    //     dac.address,
    //     deadline,
    //     )).wait();
    // await (await swapRouterContract.connect(dac).addLiquidity(
    //     linkAddress, 
    //     wethAddress, 
    //     amountLinkWETH,
    //     amountWETHConstant,
    //     amountLinkWETH,
    //     amountWETHConstant,
    //     dac.address,
    //     deadline,
    // )).wait();
    // await (await swapRouterContract.connect(dac).addLiquidity(
    //     linkAddress, 
    //     wmaticAddress, 
    //     amountLinkWMATIC,
    //     amountWMATICConstant,
    //     amountLinkWMATIC,
    //     amountWMATICConstant,
    //     dac.address,
    //     deadline,
    // )).wait();
    

    // console.log(`pair_wmatic_usdc : ${await pair_wmatic_usdc.token0()} : ${await pair_wmatic_usdc.token1()} == ${await pair_wmatic_usdc.getReserves()}` );
    // console.log(`pair_weth_usdc : ${await pair_weth_usdc.token0()} : ${await pair_weth_usdc.token1()} == ${await pair_weth_usdc.getReserves()}` );
    // console.log(`pair_link_usdc : ${await pair_link_usdc.token0()} : ${await pair_link_usdc.token1()} == ${await pair_link_usdc.getReserves()}` );
    // console.log(`pair_weth_wmatic : ${await pair_weth_wmatic.token0()} : ${await pair_weth_wmatic.token1()} == ${await pair_weth_wmatic.getReserves()}` );
    // console.log(`pair_weth_link : ${await pair_weth_link.token0()} : ${await pair_weth_link.token1()} == ${await pair_weth_link.getReserves()}` );
    // console.log(`pair_link_wmatic : ${await pair_link_wmatic.token0()} : ${await pair_link_wmatic.token1()} == ${await pair_link_wmatic.getReserves()}` );
    // /**
    //  * 3. token deposit 수행
    //  */
    // console.log("deposit wmatic");
    // await (await wmaticContract.approve(product.address, parseEther("100"))).wait();
    // await (await product.deposit(wmaticAddress, parseEther("100"), dac.address)).wait();
    // console.log("success!");
    // console.log("deposit weth");
    // await (await wethContract.approve(product.address, parseEther("10"))).wait();
    // await (await product.deposit(wethAddress, parseEther("10"), dac.address)).wait();
    // console.log("success!");
    // console.log("deposit usdc");
    // await (await usdcContract.approve(product.address, parseUnits("100", 6))).wait();
    // await (await product.deposit(usdcAddress, parseUnits("100", 6), dac.address)).wait();
    // console.log("success!");
    // console.log("deposit link");
    // await (await linkContract.approve(product.address, parseEther("1000"))).wait();
    // await (await product.deposit(linkAddress, parseEther("1000"), dac.address)).wait();
    // console.log("success!");

    // console.log("product portfolio value: ", (await product.portfolioValue()).toString());
    // console.log("product wmatic balance / value: ", (await product.assetBalance(wmaticAddress)).toString(), (await product.assetValue(wmaticAddress)).toString());
    // console.log("product weth balance / value: ", (await product.assetBalance(wethAddress)).toString(), (await product.assetValue(wethAddress)).toString());
    // console.log("product link balance / value: ", (await product.assetBalance(linkAddress)).toString(), (await product.assetValue(linkAddress)).toString());
    // console.log("product usdc balance / value: ", (await product.assetBalance(usdcAddress)).toString(), (await product.assetValue(usdcAddress)).toString());
    
    // console.log("user share token: ", (await product.balanceOf(dac.address)).toString());


    // /**
    //  * 4. rebalance 호출 확인
    //  */
    // console.log("here");
    // let estimatedGas = await product.estimateGas.rebalance();
    // console.log("call rebalancing with link token deposit");
    // console.log("estimated gas limit: ", estimatedGas);
    // await (await product.rebalance({gasLimit: 5000000})).wait();

    // console.log("product portfolio value: ", (await product.portfolioValue()).toString());
    // console.log("product wmatic balance / value: ", (await product.assetBalance(wmaticAddress)).toString(), (await product.assetValue(wmaticAddress)).toString());
    // console.log("product weth balance / value: ", (await product.assetBalance(wethAddress)).toString(), (await product.assetValue(wethAddress)).toString());
    // console.log("product link balance / value: ", (await product.assetBalance(linkAddress)).toString(), (await product.assetValue(linkAddress)).toString());
    // console.log("product usdc balance / value: ", (await product.assetBalance(usdcAddress)).toString(), (await product.assetValue(usdcAddress)).toString());
    
    // console.log("user share token: ", (await product.balanceOf(dac.address)).toString());

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

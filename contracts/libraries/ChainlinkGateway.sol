// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

library ChainlinkGateway {
    /**
     * Returns the latest price.
     */
    function getLatestPrice(address oracleAddress) public view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(oracleAddress);
        (
            /* uint80 roundID */,
            int price,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = priceFeed.latestRoundData();

        // price uint256으로 바꾸고 
        // uint256 

        return uint(price) * (10**10);
    }
}
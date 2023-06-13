//SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

interface IBalancerPool {
    function balanceOf(address) external view returns(uint256);
    function getRate() external view returns(uint256);
    function getPoolId() external view returns(bytes32);
}
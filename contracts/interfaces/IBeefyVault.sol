// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.9.0;

interface IBeefyVault {
    function deposit(uint256) external;
    function depositAll() external;
    function withdraw(uint256) external;
    function withdrawAll() external;
    function balance() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function getPricePerFullShare() external view returns (uint256);
}
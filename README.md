# Quinoa Protocol

The Quinoa Protocol is an Ethereum Smart Contract for risk managing portfolio with rule-based dynamic asset allococation.
Through the Product contracts, accounts can invest their funds in diverse assets to receive share tokens.
The share tokens represent how much shares of the portfolio values funded in and run by the product.

## Contracts

- ![Full Diagrams Currently Deployed](https://ipfs.io/ipfs/bafkreig3gp3ocjfxrpw45rcccgorrstdma3mdu4n7u32of6z6mndavdvqq)

### Product 
- ERC20 tokens for representing how much shares of the portfolio values funded in and run by the product.

__Deposit/Withdraw__
- Product has interfaces including `deposit`, `withdraw`, `convertToShares`, `convertToAssets` which are inspired by standard format of [ERC4626 as Tokenized Vault Standard](https://ethereum.org/en/developers/docs/standards/tokens/erc-4626/). Users can deposit or withdraw their assets among the underlying tokens of each strategy manage.
- Each product has a buffer assets called float. The float ratio should be set by the DAC(manager of the product). When user request withdraw, the products receive the share token and return the assets from the float first. If float is not enough to cover the debt from the user, the assets run by strategies would be withdrawn in order of withdrawal queue.

__Managing Assets__
- Base underlying asset for product is USDC(for V1 version)  
- AssetParams is a struct data structure having the information of asset address, target weight for allocation in product.
- Connected to multiple strategies.
- `portfolioValue()` returns the total values of funded assets in USD basis.
- The `rebalance()` allocates the assets into strategies connected to the product. which can be called by the DAC and the Chainlink Automation Keeper.

__Security__
- In Emergency situation, the product should be called `emergencyWithdraw` being deactivated and the all assets in strategies are withdrawan.


### Strategy
- Managing a single asset for getting yields from defi ecosystem. 
- Should be implemented the logic inside 'deposit', 'delegate', 'yield'. As Quinoa-V1, the strategy leverage yield strategies in defi ecosystem such as Beefy, Balancer, Stargate.
- USDC Strategy : Deposit Stargate USDC LP tokens into Beefy USDC Pool which compounds the yield as base of USDC
- WETH Strategy : Deposit Balancer WETH-WSTETH LP into Beefy BAL_WETH-WSTETH pool which compounds the yield as base of WETH


### UsdPriceModule
- A library for features for fetching the USD prices of each asset and calcuating how much values in USD with amount of each asset. 
    
### SwapModule
- A module for utilizing swap assets using Uniswap-V2 interfaces. 
- Have swap functions for trading tokens with exact input and output and estimation functions for trading with input or output.


---
## Deployed Contract
- [Static Asset Allocation Product](https://polygonscan.com/address/0xbcf9e1c3fb0ceb5a8735dc4d64190e93f5f89368#tokentxns)
- [CPPI Product](https://polygonscan.com/address/0xe0a5ebb046387dada8a2aec46f7bdbc0b51c16dc)
- [USDC Strategy](https://polygonscan.com/address/0xD3dBb601b1EaEE0D3C306e6FFb151CA3855DF4e9#code)
- [WETH Strategy](https://polygonscan.com/address/0xB821f2aea696CAB296f75Ad51Fedbde3d263270A#code)

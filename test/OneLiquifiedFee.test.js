const { expect } = require("chai");
const { ethers } = require("hardhat");
const pancake_router_abi = require("../../abi/pancake.json");


function formatUnits(value) {
    return ethers.utils.formatUnits(value.toString(), 18)
}

function parseUnits(value) {
    return ethers.utils.parseUnits(value.toString(), 18)
}

describe(`One Liquified Fee test`, function(){
    let token
    let tokenAddress
    let tokenName = 'OneLiquifiedFee'

    let owner = ethers.provider.getSigner(0)
    let ownerAddress;

    let feeCollector = ethers.provider.getSigner(1)
    let feeCollectorAddress;

    let pancake_router_address = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    let pancake_router;
    let WETH;
    let pathB = [];
    let pathS = [];
    let decimals;
    let provider;

    let tempUser = ethers.provider.getSigner(2)
    let tempUserAddress

    it(`Test init`, async function(){
        ownerAddress = await owner.getAddress()
        feeCollectorAddress = await feeCollector.getAddress()
        provider = new ethers.providers.JsonRpcProvider(`https://bsc.meowrpc.com`)
        console.log(`Owner address ${ownerAddress}, feeCollectorAddress ${feeCollectorAddress}`)

    })

    it(`Deploying token and creating pair`, async function(){
        token = await (await (await ethers.getContractFactory(tokenName, owner)).deploy(pancake_router_address, feeCollectorAddress)).deployed()
        tokenAddress = token.address
        decimals = await token.decimals()

        console.log(`Token deployed to: ${tokenAddress}`)
        console.log(`Token decimals: ${decimals}`)
    })

    it(`Should retrieve feeCollector address`, async function(){
        let rFCaddress = await token.feeWallet()
        console.log(`rFeeCollectorAddress: ${rFCaddress}`)

        expect(rFCaddress).to.equal(feeCollectorAddress)
    })

    it(`Should add liquidity to pancakeswap`, async function(){
        let tokenToLiquidity = await token.balanceOf(ownerAddress)
        let amountTokenDesired  = tokenToLiquidity.toString()
        let amountTokenMin = amountTokenDesired
        let amountETHMin = ethers.utils.parseEther('1')
        let to = ownerAddress
        let deadLine = Date.now() + 60

        console.log(`
            Token to liquidity: ${tokenToLiquidity}\n
            Amount Token Desired: ${amountTokenDesired}\n
            Amount Token Min: ${amountTokenMin}\n
            Amount ETH min: ${amountETHMin}\n
            to: ${to}\n
            deadline: ${deadLine}
        `)

        pancake_router = new ethers.Contract(pancake_router_address, pancake_router_abi, owner)
        let approve = await token.approve(pancake_router_address, ethers.constants.MaxUint256)

        const addLiquidity = await pancake_router.addLiquidityETH(
            tokenAddress, amountTokenDesired, amountTokenMin, amountETHMin, to, deadLine, {value: amountETHMin}
        )
        await addLiquidity.wait()
        console.log(`Liquidity added successfully`)

        WETH = await pancake_router.WETH()
        pathB = [WETH, tokenAddress]
        pathS = [tokenAddress, WETH]
        console.log(`WETH: ${WETH}\n
        PathBuy: ${pathB}\n
        PathSell: ${pathS}`)
    })

    it(`Should buy one time`, async function(){
        tempUserAddress = await tempUser.getAddress()
        console.log(`Temp user address: ${tempUserAddress}`)

        let tokenToBuy = Math.floor(Math.random() * formatUnits((await token.tSupply()).toString()))
        console.log(`Buying ${tokenToBuy} tokens`)

        const amountsOut = await pancake_router.getAmountsOut(tokenToBuy, pathB);
        console.log(
            "amountsOut[0]: %s, amountsOut[1]: %s",
            amountsOut[0],
            amountsOut[1]
        ); 

        let bnbToBuy = amountsOut[0]
        console.log(`bnb to buy ${ethers.utils.formatEther(bnbToBuy.toString())}`)
        let deadLine = Date.now() + 60
        let userBalanceBefore = await token.balanceOf(tempUserAddress)
        console.log(`User balance before ${userBalanceBefore}`)
        let buy = await pancake_router.connect(tempUser).swapExactETHForTokensSupportingFeeOnTransferTokens(
            1,
            [pathB[0], pathB[1]],
            tempUserAddress,
            deadLine,
            { value: bnbToBuy }
        );
        await buy.wait()
        let contractBalance = await token.balanceOf(tokenAddress)
        console.log(`Contract balance: ${formatUnits(contractBalance)}`)
        let userBalaceA = await token.balanceOf(tempUserAddress)
        console.log(`Temp user balance after: ${userBalaceA}`)
    })

    it(`Should buy ten time`, async function(){
        tempUserAddress = await tempUser.getAddress()
        console.log(`Temp user address: ${tempUserAddress}`)
        for(let i = 0; i < 20; i++){
            console.log(`\n${i}`)
            let tokenToBuy = '20000000000000' /* Math.floor(Math.random() * formatUnits((await token.tSupply()).toString())) */
            console.log(`Buying ${tokenToBuy} tokens`)

            const amountsOut = await pancake_router.getAmountsOut(tokenToBuy, pathB);
            console.log(
                "amountsOut[0]: %s, amountsOut[1]: %s",
                amountsOut[0],
                amountsOut[1]
            ); 

            let bnbToBuy = amountsOut[0]
            console.log(`bnb to buy ${ethers.utils.formatEther(bnbToBuy.toString())}`)
            let deadLine = Date.now() + 60
            let userBalanceBefore = await token.balanceOf(tempUserAddress)
            console.log(`User balance before ${userBalanceBefore}`)
            let buy = await pancake_router.connect(tempUser).swapExactETHForTokensSupportingFeeOnTransferTokens(
                1,
                [pathB[0], pathB[1]],
                tempUserAddress,
                deadLine,
                { value: bnbToBuy }
            );
            await buy.wait()
            let contractBalance = await token.balanceOf(tokenAddress)
            console.log(`Contract balance: ${formatUnits(contractBalance)}`)
            let userBalaceA = await token.balanceOf(tempUserAddress)
            console.log(`Temp user balance after: ${userBalaceA}`)
        }
    })

    it(`Making one sell`, async function(){
        let deadLine = Date.now() + 60
        let userBalanceB = await token.balanceOf(tempUserAddress)
        console.log(`User balance before ${userBalanceB}`)
        let contractBalanceB = await token.balanceOf(tokenAddress)
        console.log(`Contract balance before ${contractBalanceB}`)
        let approve = await token.connect(tempUser).approve(pancake_router_address, userBalanceB)
        await approve.wait()
        let feeCollectorBalanceB = await feeCollector.getBalance()
        console.log(`Fee collector balance: ${feeCollectorBalanceB}`)
        let tokenToSell = '200000000000'
        console.log(`Selling ${tokenToSell} tokens`)

        const tx = await pancake_router.connect(tempUser).swapExactTokensForETHSupportingFeeOnTransferTokens(
            Math.trunc(tokenToSell).toString(),
            1,
            pathS,
            tempUserAddress,
            deadLine
          );
          await tx.wait();
          let userBalanceA = await token.balanceOf(tempUserAddress);
          console.log(`User balance after ${userBalanceA}`)
          let contractBalanceA = await token.balanceOf(tokenAddress)
          console.log(`Contract balance after ${contractBalanceA}`)
          let feeCollectorBalanceA = await feeCollector.getBalance()
        console.log(`Fee collector balance: ${feeCollectorBalanceA}`)
    })

    it(`Making 10 sell`, async function(){
        for(let i = 0; i < 10; i++){
            let deadLine = Date.now() + 60
            let userBalanceB = await token.balanceOf(tempUserAddress)
            console.log(`User balance before ${userBalanceB}`)
            let contractBalanceB = await token.balanceOf(tokenAddress)
            console.log(`Contract balance before ${contractBalanceB}`)
            let approve = await token.connect(tempUser).approve(pancake_router_address, userBalanceB)
            await approve.wait()
            let feeCollectorBalanceB = await feeCollector.getBalance()
            console.log(`Fee collector balance: ${feeCollectorBalanceB}`)
            let tokenToSell = '20000000000'
            console.log(`Selling ${tokenToSell} tokens`)

            const tx = await pancake_router.connect(tempUser).swapExactTokensForETHSupportingFeeOnTransferTokens(
                Math.trunc(tokenToSell).toString(),
                1,
                pathS,
                tempUserAddress,
                deadLine
            );
            await tx.wait();
            let userBalanceA = await token.balanceOf(tempUserAddress);
            console.log(`User balance after ${userBalanceA}`)
            let contractBalanceA = await token.balanceOf(tokenAddress)
            console.log(`Contract balance after ${contractBalanceA}`)
            let feeCollectorBalanceA = await feeCollector.getBalance()
            console.log(`Fee collector balance: ${feeCollectorBalanceA}`)
        }
    })

    it(`Should revert due to fees too high`, async function(){
        await expect(token.setBuyFee(26)).to.revertedWith('Fee too high')
        
        await expect(token.setSellFee(26)).to.revertedWith('Fee too high')
    })

    it(`Should update fee value`, async function(){
        let newBuyFee = 24;
        let newSellFee = 24;

        await token.setBuyFee(newBuyFee)
        await token.setSellFee(newSellFee)

        let rBuyFee = await token.buyFee()
        let rSellFee = await token.sellFee()

        expect(rBuyFee).to.equal(newBuyFee)
        expect(rSellFee).to.equal(newSellFee)
    })
})
let StentorToken = artifacts.require('./StentorToken.sol');
let StentorCrowdsale = artifacts.require('./StentorCrowdsale.sol');
let RefundVault = artifacts.require('./zeppelin/contracts/crowdsale/RefundVault.sol');
let VestedWallet = artifacts.require('./VestedWallet.sol');

let config = require('./../config');

contract('StentorToken', async function (accounts) {

    let token, crowdsale, vault, vestedWallet;

    const crowdsaleWallet = accounts[0];
    const foundationWallet = accounts[2];

    beforeEach(async () => {
        const startTime =  Math.floor(+new Date() / 1000) + 10; //10 seconds into the future
        const endTime =  Math.floor(+new Date() / 1000) + 3600; //1 hour into the future

        vault = await RefundVault.new(crowdsaleWallet);
        token = await StentorToken.new(config.initialSupply);
        crowdsale = await StentorCrowdsale.new(startTime, endTime, config.rate, config.goal, config.cap, vault.address, token.address);
        vestedWallet = await VestedWallet.new(foundationWallet, crowdsale.address, token.address, {from: foundationWallet});

        await token.transfer(crowdsale.address, config.cap);
        await token.transfer(vestedWallet.address, config.team.amount);
        await token.transfer(foundationWallet, config.foundation.amount);
    });

    it("Token deployed correctly with the right symbol", async () => {
        assert.equal(await token.symbol.call(), "SGT", "Token symbol not equal to SGT");
    });

    it("Token correctly transferred initialSupply", async () => {
        assert.equal(await token.balanceOf(crowdsale.address), config.cap);
        assert.equal(await token.balanceOf(vestedWallet.address), config.team.amount);
        assert.equal(await token.balanceOf(foundationWallet), config.foundation.amount);
    });

});
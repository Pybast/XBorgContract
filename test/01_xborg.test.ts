import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { json } from "hardhat/internal/core/params/argumentTypes";
const fetch = require("node-fetch");

const error = {
  "ownable": "Ownable: caller is not the owner",
  "Can not increase supply": "A6",
  "Mint has not started yet": "A4",
  "Wrong price": "A1",
  "Trying to mint too many tokens": "A2",
  "Max supply has been reached": "A3",
  "Wrong signature": "A5",
  "Can not set max supply under the current supply": "A7",
  "You don't own this token": "A8",
  "URI has been frozen": "A10",
  "No shares for this account": "A11",
  "No remaining payment": "A12", 
  "Already made the maximum of whitelist transactions allowed": "A13",
  "Already made the maximum of allowlist transactions allowed": "A14",
}

const accessControlRevert = (address : string) => {
  return `AccessControl: account ${address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
}

const roles = {
  "ADMIN": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "SIGNER": "0xe2f4eaae4a9751e85a3e4a7b9587827a877f29914755229b07a7b2da98285f70",
  "FREE_SIGNER": "0xc0d53b6b38dafcad2617ec1d5660bc901206f6e857c2d4538ad90ae7220802f5"
}

const SIGNER_ADDRESS = "0x64243A958656868385B99b9Ff6925132524792dA";

const prices = {
  whitelist: "2400000000000000",
  allowlist: "2800000000000000",
  public: "2800000000000000"
}

const HIGH_TIMESTAMP = "0xfffffffffffffffffffffff"

const stakeHolders = [
  {
    // XBORG
    address: "0x64243A958656868385B99b9Ff6925132524792dA",
    shares: 975
  },
  {
    // PARTNER
    address: "0xF43621e9fB01c6632520B6D18d63196a0c2e1159",
    shares: 25
  }
]

describe("Xborg", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function deployXborgContract() {

    // Contracts are deployed using the first signer/account by default
    const [owner, minter, allowlistMinter] = await ethers.getSigners();

    const ECDSA = await ethers.getContractFactory("ECDSALibrary");
    const ecdsa = await ECDSA.deploy();

    const XBORG = await ethers.getContractFactory("Xborg", {
      libraries: {
        ECDSALibrary: ecdsa.address
      }
    });
    const ownerXborg = await XBORG.deploy();
    const minterXborg = await ownerXborg.connect(minter);
    const allowlistMinterXborg = await ownerXborg.connect(allowlistMinter);

    return { ownerXborg, minterXborg, allowlistMinterXborg, owner, minter, allowlistMinter };
  }

  describe("Deployment", function () {
    // Deploys and checks if the contract is setup correctly
    it("Can deploy contracts", async () => {
      const { ownerXborg, owner, minter } = await loadFixture(deployXborgContract);

      expect(ownerXborg.address).to.not.be.undefined;
    });

    it("Interfaces are set correctly", async () => {
      const { ownerXborg, owner, minter } = await loadFixture(deployXborgContract);

      // ERC165
      expect(await ownerXborg.supportsInterface("0x01ffc9a7")).to.be.true;

      // ERC721
      expect(await ownerXborg.supportsInterface("0x80ac58cd")).to.be.true;

      // ERC721Metadata
      expect(await ownerXborg.supportsInterface("0x5b5e139f")).to.be.true;
    });

    it("All default parameters are set correctly", async () => {
      const { ownerXborg, owner, minter } = await loadFixture(deployXborgContract);

      // tokenURI

      // Uri is not frozen
      expect(await ownerXborg.isUriFrozenForEver()).to.be.false;

      // Sale time is very big
      const expectedTimes = [
        ethers.BigNumber.from("0xfffffffffffffffffffffff"),
        ethers.BigNumber.from("0xfffffffffffffffffffffff"),
        ethers.BigNumber.from("0xfffffffffffffffffffffff")
      ]
      const saleTimes = await ownerXborg.getSalesTimes();
      saleTimes.forEach((time : any, index : number) => {
        expect(time).to.equal(expectedTimes[index]);
      })
      
      // Price of tokens
      const [whiteslitPrice, allowlistPrice, publicPrice] = await ownerXborg.getPrices();
      expect(allowlistPrice).to.equal(ethers.BigNumber.from(prices.allowlist));
      expect(whiteslitPrice).to.equal(ethers.BigNumber.from(prices.whitelist));
      expect(publicPrice).to.equal(ethers.BigNumber.from(prices.public));
      
      // Max mint per transactions
      const [maxAllowlistMint, maxWhitelistMint, maxPublicMint] = await ownerXborg.getMaxMintsPerTx();
      expect(maxAllowlistMint).to.equal(2);
      expect(maxWhitelistMint).to.equal(2);
      expect(maxPublicMint).to.equal(2);

      // Max supply
      expect(await ownerXborg.getMaxSupply()).to.equal(1111);
    });
  });

  describe("Setup", function () {
    // Can change various properties in the smart contract

    it("Can't change price if not owner", async () => {
      const { minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await expect(minterXborg.setSalePrices(
        ethers.BigNumber.from("1000000"), 
        ethers.BigNumber.from("2000000"), 
        ethers.BigNumber.from("3000000")
      )).to.be.revertedWith(error["ownable"])

      const [whiteslitPrice, allowlistPrice, publicPrice] = await minterXborg.getPrices();
      expect(allowlistPrice).to.equal(ethers.BigNumber.from(prices.allowlist));
      expect(whiteslitPrice).to.equal(ethers.BigNumber.from(prices.whitelist));
      expect(publicPrice).to.equal(ethers.BigNumber.from(prices.public));
    });

    it("Can change prices", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await ownerXborg.setSalePrices(
        ethers.BigNumber.from("250000000000000000"), 
        ethers.BigNumber.from("350000000000000000"), 
        ethers.BigNumber.from("450000000000000000")
      )

      const [allowlistPrice, whiteslitPrice, publicPrice] = await minterXborg.getPrices();
      expect(allowlistPrice).to.equal(ethers.BigNumber.from("250000000000000000"));
      expect(whiteslitPrice).to.equal(ethers.BigNumber.from("350000000000000000"));
      expect(publicPrice).to.equal(ethers.BigNumber.from("450000000000000000"));
    });

    it("Can't change max mint per transaction", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await expect(minterXborg.setMaxMintsPerTx(5, 4, 3)).to.be.revertedWith(error["ownable"]);
    });

    it("Change max mint per transaction", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await ownerXborg.setMaxMintsPerTx(6, 5, 4);

      const [maxAllowlistMint, maxWhitelistMint, maxPublicMint] = await ownerXborg.getMaxMintsPerTx();
      expect(maxAllowlistMint).to.equal(6);
      expect(maxWhitelistMint).to.equal(5);
      expect(maxPublicMint).to.equal(4);
    });

    it("Can't reduce max supply if not owner", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await expect(minterXborg.reduceMaxSupply(20)).to.be.revertedWith(error["ownable"]);
    });

    it("Can't increase max supply", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await expect(ownerXborg.reduceMaxSupply(20000)).to.be.revertedWith(error["Can not increase supply"]);
    });

    it("Can't set max supply under current supply", async () => {
      const { ownerXborg, allowlistMinterXborg, owner, allowlistMinter } = await loadFixture(deployXborgContract);
      await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, 2000, HIGH_TIMESTAMP)).wait();

      await ownerXborg.grantRole(
        roles["SIGNER"],
        SIGNER_ADDRESS
      )

      const signature = await fetch(`http://127.0.0.1:10721/getMintSignature?address=${allowlistMinter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { alSignature: any; }) => json.alSignature);
      
      const receipt = await (await allowlistMinterXborg.AllowlistMint(
        2,
        signature,
        { value: ethers.BigNumber.from(prices.allowlist).mul(2) }
      ))

      await expect(ownerXborg.reduceMaxSupply(1)).to.be.revertedWith(error["Can not set max supply under the current supply"])
    });

    it("Reduce max supply", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
      
      await ownerXborg.reduceMaxSupply(20);

      expect(await ownerXborg.getMaxSupply()).to.equal(20);
    });

    it("Can't change sale time if not owner", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await expect(minterXborg.setSalesTimes(
        Math.floor((new Date()).getTime()/1000),
        Math.floor((new Date()).getTime()/1000),
        Math.floor((new Date()).getTime()/1000)
      )).to.be.revertedWith(error["ownable"]);
    });

    it("Change sale time", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await ownerXborg.setSalesTimes(
        Math.floor((new Date()).getTime()/1000),
        Math.floor((new Date()).getTime()/1000),
        Math.floor((new Date()).getTime()/1000)
      );
    });

    it("Can't change base URI if not owner", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await expect(minterXborg.setBaseURI(
        "ipfs://hash"
      )).to.be.revertedWith(error["ownable"]);
    });

    it("Can set base URI", async () => {
      const { ownerXborg, allowlistMinterXborg, owner, allowlistMinter } = await loadFixture(deployXborgContract);

      await ownerXborg.setBaseURI("ipfs://hash/");

      await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, 2000, HIGH_TIMESTAMP)).wait();

      await ownerXborg.grantRole(
        roles["SIGNER"],
        SIGNER_ADDRESS
      )

      const signature = await fetch(`http://127.0.0.1:10721/getMintSignature?address=${allowlistMinter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { alSignature: any; }) => json.alSignature);
      
      const receipt = await (await allowlistMinterXborg.AllowlistMint(
        2,
        signature,
        { value: ethers.BigNumber.from(prices.allowlist).mul(2) }
      ))

      expect(await ownerXborg.tokenURI(1)).to.equal("ipfs://hash/1");
    });

    it("Can't give roles if not owner", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await expect(minterXborg.grantRole(
        roles["SIGNER"],
        owner.address
      )).to.be.revertedWith(accessControlRevert(minter.address));
    });

    it("Can give roles if owner", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await ownerXborg.grantRole(
        roles["SIGNER"],
        owner.address
      );
      
      expect(await ownerXborg.hasRole(roles["SIGNER"], owner.address)).to.be.true;
      expect(await ownerXborg.hasRole(roles["SIGNER"], minter.address)).to.be.false;
    });
  });

  describe("Pre sale", function () {

    it("Can't allowlist mint if sale is not started", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await expect(minterXborg.AllowlistMint(
        1, 
        "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c", 
        { value: ethers.BigNumber.from(prices.allowlist) }
      )).to.be.rejectedWith(error["Mint has not started yet"]);
    });

    it("Can't whiteliste mint if sale is not started", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await expect(minterXborg.whitelistMint(
        1, 
        "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c", 
        { value: ethers.BigNumber.from(prices.whitelist) }
      )).to.be.rejectedWith(error["Mint has not started yet"]);
    });

    it("Can't public mint if sale is not started", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await expect(minterXborg.publicMint(
        1, 
        { value: ethers.BigNumber.from(prices.public) }
      )).to.be.rejectedWith(error["Mint has not started yet"]);
    });

    it("Can't start sale if not owner", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
      
      await expect(minterXborg.setSalesTimes(0, HIGH_TIMESTAMP, HIGH_TIMESTAMP)).to.be.revertedWith(error["ownable"]);
      await expect(minterXborg.setSalesTimes(HIGH_TIMESTAMP, 0, HIGH_TIMESTAMP)).to.be.revertedWith(error["ownable"]);
      await expect(minterXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 0)).to.be.revertedWith(error["ownable"]);
    });

    it("Can start sale", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await (await ownerXborg.setSalesTimes(2000, HIGH_TIMESTAMP, 0)).wait();

      // Sale time is very big
      const expectedTimes = [
        2000,
        HIGH_TIMESTAMP,
        0
      ]
      const saleTimes = await ownerXborg.getSalesTimes();
      saleTimes.forEach((time : any, index : number) => {
        expect(time).to.equal(expectedTimes[index]);
      })
    });
  })

  describe("mint", function () {
    describe("allowlist mint", function () {
      it("Can't allowlist mint if price is wrong", async () => {
        const { ownerXborg, allowlistMinterXborg, owner, allowlistMinter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, 2000, HIGH_TIMESTAMP)).wait();
        
        await expect(allowlistMinterXborg.AllowlistMint(
          2,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.allowlist).mul(3) }
        )).to.be.revertedWith(error["Wrong price"]);
      });
  
      it("Can't allowlist mint if maxAllowlistMintPerTx is too much", async () => {
        const { ownerXborg, allowlistMinterXborg, owner, allowlistMinter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, 2000, HIGH_TIMESTAMP)).wait();
        
        await expect(allowlistMinterXborg.AllowlistMint(
          6,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.allowlist).mul(6) }
        )).to.be.revertedWith(error["Trying to mint too many tokens"]);
      });
  
      it("Can't allowlist mint if sold out", async () => {
        const { ownerXborg, allowlistMinterXborg, owner, allowlistMinter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 2000)).wait();

        await (await ownerXborg.reduceMaxSupply(10)).wait();
        await (await ownerXborg.setMaxMintsPerTx(4, 3, 8)).wait();
        await ownerXborg.publicMint(8, { value: ethers.BigNumber.from(prices.public).mul(8) })
        
        await expect(allowlistMinterXborg.AllowlistMint(
          3,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.allowlist).mul(3) }
        )).to.be.revertedWith(error["Max supply has been reached"]);
      });

      it("Can't allowlist mint if signature is wrong", async () => {
        const { ownerXborg, allowlistMinterXborg, owner, allowlistMinter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, 2000, HIGH_TIMESTAMP)).wait();
        
        await expect(allowlistMinterXborg.AllowlistMint(
          2,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.allowlist).mul(2) }
        )).to.be.revertedWith(error["Wrong signature"]);
      });
  
      it("Can allowlist mint", async () => {
        const { ownerXborg, allowlistMinterXborg, owner, allowlistMinter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, 2000, HIGH_TIMESTAMP)).wait();

        await ownerXborg.grantRole(
          roles["SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://127.0.0.1:10721/getMintSignature?address=${allowlistMinter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { alSignature: any; }) => json.alSignature);
        
        const receipt = await (await allowlistMinterXborg.AllowlistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.allowlist).mul(2) }
        )).wait();

        expect(await ownerXborg.totalSupply()).to.equal(2);
  
        expect(receipt.events?.filter((ev : any) => ev.event === "Transfer").length).to.equal(2);
        
        for (let index = 1; index <= 2; index++) {
          // from
          expect(parseInt(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.from
          )).to.equal(0);
          // to
          expect(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.to
          ).to.equal(allowlistMinter.address);
          // tokenId
          expect(parseInt(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.tokenId
          )).to.equal(index);
        }
      });

      it("Can't allowlist more than twice", async () => {
        const { ownerXborg, allowlistMinterXborg, owner, allowlistMinter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, 2000, HIGH_TIMESTAMP)).wait();

        await ownerXborg.grantRole(
          roles["SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://127.0.0.1:10721/getMintSignature?address=${allowlistMinter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { alSignature: any; }) => json.alSignature);
        
        const receipt = await (await allowlistMinterXborg.AllowlistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.allowlist).mul(2) }
        )).wait();

        await expect(allowlistMinterXborg.AllowlistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.allowlist).mul(2) }
        )).to.be.revertedWith(error["Already made the maximum of allowlist transactions allowed"]);

        it("Number of allolist transactions has been updated", async () => {
          const [_, numberAlTransactions] = await allowlistMinterXborg.getNumberOfTransactions(allowlistMinter.address);
          expect(numberAlTransactions).to.be.equal(ethers.BigNumber.from(1));
        })
      });

      it("Can increase allowlist allowance", async () => {
        const { ownerXborg, allowlistMinterXborg, owner, allowlistMinter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, 2000, HIGH_TIMESTAMP)).wait();

        await ownerXborg.grantRole(
          roles["SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://127.0.0.1:10721/getMintSignature?address=${allowlistMinter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { alSignature: any; }) => json.alSignature);
        
        let receipt = await (await allowlistMinterXborg.AllowlistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.allowlist).mul(2) }
        )).wait();

        await (await ownerXborg.setMaxTransactions(3, 3)).wait();

        receipt = await (await allowlistMinterXborg.AllowlistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.allowlist).mul(2) }
        )).wait();

        expect(await ownerXborg.totalSupply()).to.equal(4);
  
        expect(receipt.events?.filter((ev : any) => ev.event === "Transfer").length).to.equal(2);

        // console.log(receipt)
        
        for (let index = 3; index <= 4; index++) {
          // from
          expect(parseInt(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.from
          )).to.equal(0);
          // to
          expect(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.to
          ).to.equal(allowlistMinter.address);
          
          // tokenId
          expect(parseInt(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.tokenId
          )).to.equal(index);
          
        }

        it("Number of allolist transactions has been updated", async () => {
          const [_, numberAlTransactions] = await allowlistMinterXborg.getNumberOfTransactions(allowlistMinter.address);
          expect(numberAlTransactions).to.be.equal(ethers.BigNumber.from(2));
        })
      });
    });

    describe("Whitelist mint", function () {
      it("Can't whitelist mint if price is wrong", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(2000, HIGH_TIMESTAMP, HIGH_TIMESTAMP)).wait();

        
        await expect(minterXborg.whitelistMint(
          2,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.whitelist).mul(3) }
        )).to.be.revertedWith(error["Wrong price"]);
      });
  
      it("Can't whitelist mint if maxAllowlistMintPerTx is too much", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(2000, HIGH_TIMESTAMP, HIGH_TIMESTAMP)).wait();

        
        await expect(minterXborg.whitelistMint(
          4,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.whitelist).mul(4) }
        )).to.be.revertedWith(error["Trying to mint too many tokens"]);
      });
  
      it("Can't whitelist mint if sold out", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 2000)).wait();

        await (await ownerXborg.reduceMaxSupply(10)).wait();
        await (await ownerXborg.setMaxMintsPerTx(4, 3, 8)).wait();
        await ownerXborg.publicMint(8, { value: ethers.BigNumber.from(prices.public).mul(8) })
        
        await expect(minterXborg.whitelistMint(
          3,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.whitelist).mul(3) }
        )).to.be.revertedWith(error["Max supply has been reached"]);
      });

      it("Can't whitelist mint if signature is wrong", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(2000, HIGH_TIMESTAMP, HIGH_TIMESTAMP)).wait();
        
        await expect(minterXborg.whitelistMint(
          2,
          "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c",
          { value: ethers.BigNumber.from(prices.whitelist).mul(2) }
        )).to.be.revertedWith(error["Wrong signature"]);
      });
  
      it("Can whitelist mint", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(2000, HIGH_TIMESTAMP, HIGH_TIMESTAMP)).wait();

        await ownerXborg.grantRole(
          roles["SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://127.0.0.1:10721/getMintSignature?address=${minter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { wlSignature: any; }) => json.wlSignature);
        
        const receipt = await (await minterXborg.whitelistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.whitelist).mul(2) }
        ))
      });

      it("Can't whitelist mint more than twice", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(2000, HIGH_TIMESTAMP, HIGH_TIMESTAMP)).wait();

        await ownerXborg.grantRole(
          roles["SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://127.0.0.1:10721/getMintSignature?address=${minter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { wlSignature: any; }) => json.wlSignature);
        
        const receipt = await (await minterXborg.whitelistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.whitelist).mul(2) }
        ))

        await expect(minterXborg.whitelistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.whitelist).mul(2) }
        )).to.be.revertedWith(error["Already made the maximum of whitelist transactions allowed"]);

        it("Number of allolist transactions has been updated", async () => {
          const [numberWLTransaction, _] = await minterXborg.getNumberOfTransactions(minter.address);
          expect(numberWLTransaction).to.be.equal(ethers.BigNumber.from(1));
        })
      });

      it("Can increase allowlist allowance", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(2000, HIGH_TIMESTAMP, HIGH_TIMESTAMP)).wait();

        await ownerXborg.grantRole(
          roles["SIGNER"],
          SIGNER_ADDRESS
        )

        const signature = await fetch(`http://127.0.0.1:10721/getMintSignature?address=${minter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { wlSignature: any; }) => json.wlSignature);
        
        let receipt = await (await minterXborg.whitelistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.whitelist).mul(2) }
        )).wait();

        await (await ownerXborg.setMaxTransactions(3, 3)).wait();

        receipt = await (await minterXborg.whitelistMint(
          2,
          signature,
          { value: ethers.BigNumber.from(prices.whitelist).mul(2) }
        )).wait();

        expect(await ownerXborg.totalSupply()).to.equal(4);
  
        expect(receipt.events?.filter((ev : any) => ev.event === "Transfer").length).to.equal(2);

        // console.log(receipt)
        
        for (let index = 3; index <= 4; index++) {
          // from
          expect(parseInt(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.from
          )).to.equal(0);
          // to
          expect(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.to
          ).to.equal(minter.address);
          
          // tokenId
          expect(parseInt(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.tokenId
          )).to.equal(index);
          
        }

        it("Number of allolist transactions has been updated", async () => {
          const [_, numberAlTransactions] = await minterXborg.getNumberOfTransactions(minter.address);
          expect(numberAlTransactions).to.be.equal(ethers.BigNumber.from(2));
        })
      });
    });
  
    describe("Public mint", function () {
      it("Can't public mint if price is wrong", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 2000)).wait();
        
        await expect(minterXborg.publicMint(
          2,
          { value: ethers.BigNumber.from(prices.public).mul(3) }
        )).to.be.revertedWith(error["Wrong price"]);
      });
  
      it("Can't public mint if maxAllowlistMintPerTx is too much", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 2000)).wait();
        
        await expect(minterXborg.publicMint(
          4,
          { value: ethers.BigNumber.from(prices.public).mul(4) }
        )).to.be.revertedWith(error["Trying to mint too many tokens"]);
      });
  
      it("Can't public mint if sold out", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 2000)).wait();

        await (await ownerXborg.reduceMaxSupply(10)).wait();
        await (await ownerXborg.setMaxMintsPerTx(4, 3, 8)).wait();
        await ownerXborg.publicMint(8, { value: ethers.BigNumber.from(prices.public).mul(8) })
        
        await expect(minterXborg.publicMint(
          3,
          { value: ethers.BigNumber.from(prices.public).mul(3) }
        )).to.be.revertedWith(error["Max supply has been reached"]);
      });
      
      it("Can public mint", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 0)).wait();
  
        const tx = await minterXborg.publicMint(1, { value: ethers.BigNumber.from(prices.public).mul(1)});
        const receipt = await tx.wait();
  
        expect(await ownerXborg.totalSupply()).to.equal(1);
  
        expect(receipt.events?.filter((ev : any) => ev.event === "Transfer").length).to.equal(1);
        
        // from
        expect(parseInt(
          receipt.events
            ?.filter((ev : any) => ev.event === "Transfer")[0]
            .args
            ?.from
        )).to.equal(0);
  
        // to
        expect(
          receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer")[0]
            .args
            ?.to
        ).to.equal(minter.address);
        
        // tokenId
        expect(parseInt(
          receipt.events
            ?.filter((ev : any) => ev.event === "Transfer")[0]
            .args
            ?.tokenId
        )).to.equal(1);
      });
    });
    
    // describe("FreeClaim mint", function () {
    //   it("Can't freeClaim if maxPublicMintPerTx is too much", async () => {
    //     const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        
    //     await expect(minterXborg.freeClaim(
    //       4,
    //       "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c"
    //     )).to.be.revertedWith(error["Trying to mint too many tokens"]);
    //   });
  
    //   it("Can't freeClaim if sold out", async () => {
    //     const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

    //     await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 0)).wait();

    //     await (await ownerXborg.reduceMaxSupply(10)).wait();
    //     await (await ownerXborg.setMaxMintsPerTx(4, 3, 8)).wait();
    //     await ownerXborg.publicMint(8, { value: ethers.BigNumber.from(prices.public).mul(8) })
        
    //     await expect(minterXborg.freeClaim(
    //       3,
    //       "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c"
    //     )).to.be.revertedWith(error["Max supply has been reached"]);
    //   });

    //   it("Can't freeClaim if signature is wrong", async () => {
    //     const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        
    //     await expect(minterXborg.freeClaim(
    //       2,
    //       "0xdb3381732d690805cef0bfbd8e9520b80ac6d4137e99d220d9dedcd064b01235264395736fb4aa03d18df80e6e88ae85fe303789c8de9f9cf3a02fdcdf1fc3051c"
    //     )).to.be.revertedWith(error["Wrong signature"]);
    //   });
  
    //   it("Can freeClaim", async () => {
    //     const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

    //     await ownerXborg.grantRole(
    //       roles["FREE_SIGNER"],
    //       SIGNER_ADDRESS
    //     )

    //     const signature = await fetch(`http://127.0.0.1:10721/getFreeMintSignature?address=${minter.address}&quantity=2&nonce=1`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
        
    //     const receipt = await (await minterXborg.freeClaim(
    //       2,
    //       signature
    //     ))
    //   });

    //   it("Can't freeClaim twice with the same signature", async () => {
    //     const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

    //     await ownerXborg.grantRole(
    //       roles["FREE_SIGNER"],
    //       SIGNER_ADDRESS
    //     )

    //     const signature = await fetch(`http://127.0.0.1:10721/getFreeMintSignature?address=${minter.address}&quantity=2&nonce=1`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
        
    //     const receipt = await (await minterXborg.freeClaim(
    //       2,
    //       signature
    //     ))
        
    //     await expect(minterXborg.freeClaim(
    //       2,
    //       signature
    //     )).to.be.revertedWith(error["Wrong signature"]);
    //   });
  
    //   it("Nonce is increased", async () => {
    //     const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
        
    //     expect(await ownerXborg.getNonce(minter.address)).to.equal(0); // 1

    //     await ownerXborg.grantRole(
    //       roles["FREE_SIGNER"],
    //       SIGNER_ADDRESS
    //     )

    //     const signature = await fetch(`http://127.0.0.1:10721/getFreeMintSignature?address=${minter.address}&quantity=2&nonce=1`).then((res: { json: () => any; }) => res?.json()).then((json: { signature: any; }) => json.signature);
        
    //     const receipt = await (await minterXborg.freeClaim(
    //       2,
    //       signature
    //     ))

    //     expect(await ownerXborg.getNonce(minter.address)).to.equal(1); // 1
    //   });
    // }); 
    
    describe("Airdrop", function () {
      //
      
      it("Can't airdrop if sold out", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

        await (await ownerXborg.grantRole("0x3a2f235c9daaf33349d300aadff2f15078a89df81bcfdd45ba11c8f816bddc6f", minter.address)).wait();

        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 0)).wait();

        await (await ownerXborg.reduceMaxSupply(10)).wait();
        await (await ownerXborg.setMaxMintsPerTx(4, 3, 8)).wait();
        await ownerXborg.publicMint(8, { value: ethers.BigNumber.from(prices.public).mul(8) })
        
        await expect(minterXborg.airdrop(
          3,
          minter.address          
        )).to.be.revertedWith(error["Max supply has been reached"]);
      });

      it("Can't airdrop if no role", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 0)).wait();

        await expect(minterXborg.airdrop(
          3,
          minter.address          
        )).to.be.revertedWith(`AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x3a2f235c9daaf33349d300aadff2f15078a89df81bcfdd45ba11c8f816bddc6f`);
      })
      
      it("Can airdrop", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

        await (await ownerXborg.grantRole("0x3a2f235c9daaf33349d300aadff2f15078a89df81bcfdd45ba11c8f816bddc6f", minter.address)).wait();

        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 0)).wait();

        const receipt = await (await minterXborg.airdrop(
          3,
          minter.address          
        )).wait();
        
        expect(await ownerXborg.totalSupply()).to.equal(3);
        expect(await minterXborg.ownerOf(1)).to.equal(minter.address);
        expect(await minterXborg.ownerOf(2)).to.equal(minter.address);
        expect(await minterXborg.ownerOf(3)).to.equal(minter.address);

        expect(receipt.events?.filter((ev : any) => ev.event === "Transfer").length).to.equal(3);
        
        for (let index = 1; index <= 3; index++) {
          // from
          expect(parseInt(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.from
          )).to.equal(0);
          // to
          expect(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.to
          ).to.equal(minter.address);
          // tokenId
          expect(parseInt(receipt
            .events
            ?.filter((ev : any) => ev.event === "Transfer" && parseInt(ev.args?.tokenId) === index)[0]
            .args
            ?.tokenId
          )).to.equal(index);
        }
      });
    });   

    describe("Burn", function () {
      it("Can't burn somebody else's token", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 0)).wait();
  
        const tx = await minterXborg.publicMint(1, { value: ethers.BigNumber.from(prices.public) });
        const receipt = await tx.wait();

        await expect(ownerXborg.burn(1)).to.be.revertedWith(error["You don't own this token"])
      })

      it("Can burn token", async () => {
        const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

        await (await ownerXborg.setSalesTimes(HIGH_TIMESTAMP, HIGH_TIMESTAMP, 0)).wait();
  
        const tx = await minterXborg.publicMint(1, { value: ethers.BigNumber.from(prices.public) });
        const receipt = await tx.wait();

        await (await minterXborg.burn(1)).wait();

        expect(await ownerXborg.totalSupply()).to.equal(0);
        // await expect(ownerXborg.ownerOf(1)).to.be.revertedWith("OwnerQueryForNonexistentToken()");

        await (await ownerXborg.publicMint(2, { value: ethers.BigNumber.from(prices.public).mul(2) })).wait();
        expect(await ownerXborg.totalSupply()).to.equal(2);
        expect(await ownerXborg.ownerOf(2)).to.equal(owner.address);
        expect(await ownerXborg.ownerOf(3)).to.equal(owner.address);
      })
    })
  });

  describe("Withdrawals", function () {
    it("Can't withdraw eth if not stake holder", async () => {
      const { ownerXborg, minterXborg, allowlistMinterXborg, owner, minter, allowlistMinter } = await loadFixture(deployXborgContract);

      await expect(minterXborg.withdraw(minter.address)).to.be.revertedWith(error["No shares for this account"]);
    })

    it("Can withdraw all stake holders", async () => {
      const { ownerXborg, minterXborg, allowlistMinterXborg, owner, minter, allowlistMinter } = await loadFixture(deployXborgContract);

      await (await ownerXborg.setSalesTimes(0, 0, 0)).wait();

      await ownerXborg.grantRole(
        roles["SIGNER"],
        SIGNER_ADDRESS
      )      
      
      let tx = await minterXborg.publicMint(2, { value: ethers.BigNumber.from(prices.public).mul(2)});
      let receipt = await tx.wait();
      
      let signature = await fetch(`http://127.0.0.1:10721/getMintSignature?address=${allowlistMinter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { alSignature: any; }) => json.alSignature);
      tx = await allowlistMinterXborg.AllowlistMint(
        2,
        signature,
        { value: ethers.BigNumber.from(prices.allowlist).mul(2) }
        )
      receipt = await tx.wait();
        
      signature = await fetch(`http://127.0.0.1:10721/getMintSignature?address=${minter.address}`).then((res: { json: () => any; }) => res?.json()).then((json: { wlSignature: any; }) => json.wlSignature);
      receipt = await (await minterXborg.whitelistMint(
        2,
        signature,
        { value: ethers.BigNumber.from(prices.whitelist).mul(2) }
        )).wait();
        
        const totalReceivedContract = await ethers.provider.getBalance(
          ownerXborg.address
          );
          
      for (let index = 0; index < stakeHolders.length; index++) {
        const _address = stakeHolders[index].address;
        const previousBalance = await ethers.provider.getBalance(_address);
        
        await ownerXborg.withdraw(_address);

        const newBalance = await ethers.provider.getBalance(_address);

        expect(newBalance.sub(previousBalance)).to.equal(totalReceivedContract.mul(stakeHolders[index].shares).div(1000))
      }
      
    })

  });

  describe("Collection's lifespan", function () {
    it("Can freeze metadata", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);

      await ownerXborg.freezeMetadata();
      expect(await ownerXborg.isUriFrozenForEver()).to.be.true;

      await expect(ownerXborg.setBaseURI("newBaseUri")).to.be.revertedWith(error["URI has been frozen"]);
    })

    it("Can transfer ownership", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
      
      await (await ownerXborg.transferOwnership(minter.address)).wait();

      await (await minterXborg.setSalesTimes(2000, HIGH_TIMESTAMP, 0)).wait();
      
      // Sale time is very big
      const expectedTimes = [
        2000,
        HIGH_TIMESTAMP,
        0
      ]
      const saleTimes = await ownerXborg.getSalesTimes();
      saleTimes.forEach((time : any, index : number) => {
        expect(time).to.equal(expectedTimes[index]);
      })
    })

    it("Can give Admin role", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
      
      expect(await ownerXborg.hasRole(roles["ADMIN"], minter.address)).to.be.false;
      
      await (await ownerXborg.grantRole(roles["ADMIN"], minter.address));

      expect(await ownerXborg.hasRole(roles["ADMIN"], minter.address)).to.be.true;

    })

    it("Can revoke roles", async () => {
      const { ownerXborg, minterXborg, owner, minter } = await loadFixture(deployXborgContract);
      
      expect(await ownerXborg.hasRole(roles["ADMIN"], owner.address)).to.be.true;
      
      await (await ownerXborg.revokeRole(roles["ADMIN"], owner.address));

      expect(await ownerXborg.hasRole(roles["ADMIN"], owner.address)).to.be.false;
    })
  })
});

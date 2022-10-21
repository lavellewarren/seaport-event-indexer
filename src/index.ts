import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import SEAPORT_ABI from './seaport.json';
import { Pool } from 'pg';

dotenv.config();

const {
  BigNumber,
  utils: { formatUnits },
} = ethers;

const SEAPORT_CONTRACT_ADDRESS = process.env?.SEAPORT_CONTRACT_ADDRESS ?? '0x00000000006c3852cbef3e08e8df289169ede581';
const ALCHEMY_PROVIDER_URL = process.env?.ALCHEMY_PROVIDER_URL ?? 'https://mainnet.infura.io/v3/';
const POSTGRESQL_CONNECTION_URI =
  process.env?.POSTGRESQL_CONNECTION_URI ?? 'postgres://username:password@localhost:5432/dbname';

const pool = new Pool({
  connectionString: POSTGRESQL_CONNECTION_URI,
});
const createSaleRecord = async (values: Array<string | number>) => {
  await pool.query(
    'INSERT INTO "Sale"(transaction_hash, seller_address, buyer_address, nft_collection_address, nft_token_id, quantity_sold, amount_paid) VALUES($1, $2, $3, $4, $5, $6, $7)',
    values,
  );
};

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_PROVIDER_URL);
  const seaportContract = new ethers.Contract(SEAPORT_CONTRACT_ADDRESS, SEAPORT_ABI, provider);

  seaportContract.on('OrderFulfilled', async (orderHash, offerer, zone, recipient, offer, consideration, data) => {
    try {
      const isNFT = offer[0]['itemType'] === 2 || offer[0]['itemType'] === 3; // ERC721: 2, ERC1155: 3
      if (!isNFT) return;

      const { transactionHash } = data;
      const sellerAddress = offerer;
      const buyerAddress = recipient;
      const nftCollectionAddress = offer[0]['token'];
      const nftTokenId = BigNumber.from(offer[0]['identifier']).toString();
      const quantitySold = BigNumber.from(offer[0]['amount']).toNumber();
      const recipeItem = consideration.find(
        (item: any) => String(item.recipient).toLowerCase() === String(offerer).toLowerCase(),
      );
      const amountPaid = recipeItem ? Number(formatUnits(recipeItem['amount'])) : 0;

      await createSaleRecord([
        transactionHash,
        sellerAddress,
        buyerAddress,
        nftCollectionAddress,
        nftTokenId,
        quantitySold,
        amountPaid,
      ]);

      console.log(`Created new sale record of txn: ${transactionHash}\n`);
    } catch (err) {
      console.log(err);
    }
  });
};

main();

// Read-only calls to the Habeas contract, through simulation: free, no
// signature, no transaction.
import { Account, Address, BASE_FEE, Contract, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative, type xdr } from "@stellar/stellar-sdk";

// Any valid account works as the source of a simulation.
const SIM_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export type CaseRecord = {
  id: number;
  holder: string;
  amount: bigint;
  reason: string;
  statement: string;
  status: string;
  openedAt: number;
  answerBy: number;
  reviewBy: number;
  endedBy: string;
  taken: bigint;
};

const variant = (v: unknown) => (Array.isArray(v) ? String(v[0]) : String(v));

export class Habeas {
  readonly server: rpc.Server;
  readonly contractId: string;

  constructor(rpcUrl: string, contractId: string) {
    this.server = new rpc.Server(rpcUrl);
    this.contractId = contractId;
  }

  private async read(method: string, ...args: xdr.ScVal[]): Promise<unknown> {
    const tx = new TransactionBuilder(new Account(SIM_SOURCE, "0"), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(new Contract(this.contractId).call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      throw new Error(`the contract refused ${method}: ${"error" in sim ? String(sim.error).split("\n")[0] : "no result"}`);
    }
    return scValToNative(sim.result.retval);
  }

  async config(): Promise<{ issuer: string; reviewer: string }> {
    const c = (await this.read("get_config")) as { issuer: string; reviewer: string };
    return { issuer: c.issuer, reviewer: c.reviewer };
  }

  async getCase(id: number): Promise<CaseRecord> {
    const c = (await this.read("get_case", nativeToScVal(id, { type: "u64" }))) as Record<string, unknown>;
    return {
      id: Number(c.id),
      holder: String(c.holder),
      amount: BigInt(c.amount as bigint),
      reason: variant(c.reason),
      statement: String(c.statement ?? ""),
      status: variant(c.status),
      openedAt: Number(c.opened_at),
      answerBy: Number(c.answer_by),
      reviewBy: Number(c.review_by),
      endedBy: variant(c.ended_by),
      taken: BigInt(c.taken as bigint),
    };
  }

  async casesFor(holder: string): Promise<number[]> {
    const ids = (await this.read("cases_for", new Address(holder).toScVal())) as bigint[];
    return ids.map(Number);
  }

  async activeCase(holder: string): Promise<number | null> {
    const id = await this.read("active_case", new Address(holder).toScVal());
    return id === null || id === undefined ? null : Number(id);
  }

  async latestLedger(): Promise<number> {
    return (await this.server.getLatestLedger()).sequence;
  }
}

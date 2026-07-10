import "dotenv/config";
import { sendManualPvpQueueTelegramTest } from "./pvp-queue-telegram";

async function main() {
  try {
    const result = await sendManualPvpQueueTelegramTest();
    console.log("[telegram] manual PvP queue test sent", {
      messageId: result.messageId,
      thread: process.env.TELEGRAM_MESSAGE_THREAD_ID ? "configured" : "none",
    });
  } catch (error) {
    console.error(
      "[telegram] manual PvP queue test failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  }
}

void main();

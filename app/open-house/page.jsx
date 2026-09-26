import BandReadyChallenge from "./BandReadyChallenge";
import styles from "./open-house.module.css";
import ArchiveBanner from "@/components/ArchiveBanner";

export const metadata = {
  title: "Band Ready Challenge | Ashley Bands",
  description: "Complete the Ashley Bands Open House challenge and get ready for the first day."
};

export default function OpenHousePage() {
  return (
    <main className={styles.page}>
      <ArchiveBanner event="the Band Ready Challenge from the August 18, 2026 Open House" />
      <BandReadyChallenge />
    </main>
  );
}

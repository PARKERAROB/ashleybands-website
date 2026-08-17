import BandReadyChallenge from "./BandReadyChallenge";
import styles from "./open-house.module.css";

export const metadata = {
  title: "Band Ready Challenge | Ashley Bands",
  description: "Complete the Ashley Bands Open House challenge and get ready for the first day."
};

export default function OpenHousePage() {
  return (
    <main className={styles.page}>
      <BandReadyChallenge />
    </main>
  );
}

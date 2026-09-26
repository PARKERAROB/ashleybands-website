import styles from "./MoneyLine.module.css";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });

/**
 * One amount of money, with what a parent needs to trust it.
 *
 * purpose:  what it's for ("Marching band season fee").
 * amount:   a number (formatted as dollars) or a ready string ("$5 or more").
 * receiver: who receives the money ("Ashley High School Band Boosters").
 * receipt:  optional note on how the receipt arrives.
 */
export default function MoneyLine({ purpose, amount, receiver, receipt, className }) {
  const shownAmount = typeof amount === "number" ? usd.format(amount) : amount;
  return (
    <div className={className ? `${styles.line} ${className}` : styles.line}>
      <p className={styles.purpose}>{purpose}</p>
      <p className={styles.amount}>{shownAmount}</p>
      {receiver ? (
        <p className={styles.details}>
          Paid to <strong>{receiver}</strong>
        </p>
      ) : null}
      {receipt ? <p className={styles.details}>{receipt}</p> : null}
    </div>
  );
}

import BlurBackground from "./components/BlurBackground";

export default function Home() {
  const imageUrl = "/images/ec_youngvic_afaceinthecrowd_webportrait_700x900px_new.jpg";

  return (
    <main style={{ padding: 20 }}>
      <h1>Blur Background Demo</h1>
      <BlurBackground imageUrl={imageUrl} />
    </main>
  );
}

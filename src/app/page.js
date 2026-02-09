import { productsData } from "../data/productsData";
import ProductCard from "../components/ProductCard";

export default function Home() {

  return (
    <div className="container py-5 mt-5">
      <h2 className="fw-bold mb-4">Products</h2>

      <div className="row g-4" >
        {productsData.map((p) => (
          <div key={p.id} className="col-md-4">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

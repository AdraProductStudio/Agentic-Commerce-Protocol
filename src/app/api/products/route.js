import { productsData } from "@/data/productsData";

export async function GET(req) {

  return Response.json({
    data : productsData
  })
}

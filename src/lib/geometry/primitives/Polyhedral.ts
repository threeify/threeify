//
// based on PlaneGeometry from Three.js
//
// Authors:
// * @bhouston
//

import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { Float32Attribute } from "../Attribute";
import { Geometry } from "../Geometry";
import { computeVertexNormals } from "../Normals";

/*
export function octahedron(radius = 1, detail = 1) {
  const vertices = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1];
  const indices = [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2];

  return polyhedron(vertices, indices, radius, detail);
}*/

export function polyhedron(vertices: number[], indices: number[], radius = 1, detail = 0): Geometry {
  // default buffer data
  console.log("radius", radius);
  const vertexBuffer: number[] = [];
  const uvBuffer: number[] = [];

  // the subdivision creates the vertex buffer data

  subdivide(detail);

  // all vertices should lie on a conceptual sphere with a given radius

  applyRadius(radius);

  // finally, create the uv data

  generateUVs();

  // build non-indexed geometry

  const geometry = new Geometry();
  geometry.attributes["position"] = new Float32Attribute(vertexBuffer, 3);
  geometry.attributes["normal"] = new Float32Attribute(vertexBuffer.slice(), 3);
  geometry.attributes["uv"] = new Float32Attribute(uvBuffer, 2);

  computeVertexNormals(geometry);

  // helper functions

  function subdivide(detail: number): void {
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();

    // iterate over all faces and apply a subdivison with the given detail value

    for (let i = 0; i < indices.length; i += 3) {
      // get the vertices of the face

      getVertexByIndex(indices[i + 0], a);
      getVertexByIndex(indices[i + 1], b);
      getVertexByIndex(indices[i + 2], c);

      // perform subdivision

      subdivideFace(a, b, c, detail);
    }
  }

  function subdivideFace(a: Vector3, b: Vector3, c: Vector3, detail: number): void {
    console.log("subdivideFace", a, b, c, detail);
    const cols = Math.pow(2, detail);

    // we use this multidimensional array as a data structure for creating the subdivision

    const v: Vector3[][] = [];

    // construct all of the vertices for this subdivision

    for (let i = 0; i <= cols; i++) {
      v[i] = [];

      const aj = a.clone().lerp(c, i / cols);
      const bj = b.clone().lerp(c, i / cols);

      const rows = cols - i;

      for (let j = 0; j <= rows; j++) {
        if (j === 0 && i === cols) {
          v[i][j] = aj;
        } else {
          v[i][j] = aj.clone().lerp(bj, j / rows);
        }
      }
    }

    // construct all of the faces

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2 * (cols - i) - 1; j++) {
        const k = Math.floor(j / 2);

        if (j % 2 === 0) {
          pushVertex(v[i][k + 1]);
          pushVertex(v[i + 1][k]);
          pushVertex(v[i][k]);
        } else {
          pushVertex(v[i][k + 1]);
          pushVertex(v[i + 1][k + 1]);
          pushVertex(v[i + 1][k]);
        }
      }
    }
  }

  function applyRadius(radius: number): void {
    const vertex = new Vector3();

    // iterate over the entire buffer and apply the radius to each vertex

    for (let i = 0; i < vertexBuffer.length; i += 3) {
      vertex.x = vertexBuffer[i + 0];
      vertex.y = vertexBuffer[i + 1];
      vertex.z = vertexBuffer[i + 2];
      console.log("applyRadius b", JSON.stringify(vertex));
      console.log("radius", radius);

      vertex.normalize().multiplyByScalar(radius);
      console.log("applyRadius a", JSON.stringify(vertex));

      vertexBuffer[i + 0] = vertex.x;
      vertexBuffer[i + 1] = vertex.y;
      vertexBuffer[i + 2] = vertex.z;
    }
  }

  function generateUVs(): void {
    const vertex = new Vector3();

    for (let i = 0; i < vertexBuffer.length; i += 3) {
      vertex.x = vertexBuffer[i + 0];
      vertex.y = vertexBuffer[i + 1];
      vertex.z = vertexBuffer[i + 2];

      const u = azimuth(vertex) / 2 / Math.PI + 0.5;
      const v = inclination(vertex) / Math.PI + 0.5;
      uvBuffer.push(u, 1 - v);
    }

    correctUVs();

    correctSeam();
  }

  function correctSeam(): void {
    // handle case when face straddles the seam, see #3269

    for (let i = 0; i < uvBuffer.length; i += 6) {
      // uv data of a single face

      const x0 = uvBuffer[i + 0];
      const x1 = uvBuffer[i + 2];
      const x2 = uvBuffer[i + 4];

      const max = Math.max(x0, x1, x2);
      const min = Math.min(x0, x1, x2);

      // 0.9 is somewhat arbitrary

      if (max > 0.9 && min < 0.1) {
        if (x0 < 0.2) {
          uvBuffer[i + 0] += 1;
        }
        if (x1 < 0.2) {
          uvBuffer[i + 2] += 1;
        }
        if (x2 < 0.2) {
          uvBuffer[i + 4] += 1;
        }
      }
    }
  }

  function pushVertex(vertex: Vector3): void {
    console.log("pushVertex", vertex);
    vertexBuffer.push(vertex.x, vertex.y, vertex.z);
  }

  function getVertexByIndex(index: number, vertex: Vector3): void {
    const stride = index * 3;

    vertex.x = vertices[stride + 0];
    vertex.y = vertices[stride + 1];
    vertex.z = vertices[stride + 2];
  }

  function correctUVs(): void {
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();

    const centroid = new Vector3();

    const uvA = new Vector2();
    const uvB = new Vector2();
    const uvC = new Vector2();

    for (let i = 0, j = 0; i < vertexBuffer.length; i += 9, j += 6) {
      a.set(vertexBuffer[i + 0], vertexBuffer[i + 1], vertexBuffer[i + 2]);
      b.set(vertexBuffer[i + 3], vertexBuffer[i + 4], vertexBuffer[i + 5]);
      c.set(vertexBuffer[i + 6], vertexBuffer[i + 7], vertexBuffer[i + 8]);

      uvA.set(uvBuffer[j + 0], uvBuffer[j + 1]);
      uvB.set(uvBuffer[j + 2], uvBuffer[j + 3]);
      uvC.set(uvBuffer[j + 4], uvBuffer[j + 5]);

      centroid
        .copy(a)
        .add(b)
        .add(c)
        .multiplyByScalar(1.0 / 3);

      const azi = azimuth(centroid);

      correctUV(uvA, j + 0, a, azi);
      correctUV(uvB, j + 2, b, azi);
      correctUV(uvC, j + 4, c, azi);
    }
  }

  function correctUV(uv: Vector2, stride: number, vector: Vector3, azimuth: number): void {
    if (azimuth < 0 && uv.x === 1) {
      uvBuffer[stride] = uv.x - 1;
    }

    if (vector.x === 0 && vector.z === 0) {
      uvBuffer[stride] = azimuth / 2 / Math.PI + 0.5;
    }
  }

  // TODO: Replace with PolarCoordinate System.
  // Angle around the Y axis, counter-clockwise when looking from above.

  function azimuth(vector: Vector3): number {
    return Math.atan2(vector.z, -vector.x);
  }

  // Angle above the XZ plane.

  function inclination(vector: Vector3): number {
    return Math.atan2(-vector.y, Math.sqrt(vector.x * vector.x + vector.z * vector.z));
  }

  return geometry;
}

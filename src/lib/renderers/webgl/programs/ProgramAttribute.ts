//
// program attribute from introspection
//
// Authors:
// * @bhouston
//

import { BufferAccessor } from "../buffers/BufferAccessor";
import { GL } from "../GL";
import { Program } from "./Program";

export class ProgramAttribute {
  name: string;
  size: number;
  type: number;
  glLocation: number; // attributes are indexed

  constructor(public program: Program, public index: number) {
    this.name = name;

    const gl = program.context.gl;

    // look up uniform locations
    {
      const activeInfo = gl.getActiveAttrib(program.glProgram, index);
      if (activeInfo === null) {
        throw new Error(`can not find attribute with index: ${index}`);
      }

      this.name = activeInfo.name;
      this.size = activeInfo.size;
      this.type = activeInfo.type;

      const glLocation = gl.getAttribLocation(program.glProgram, this.name);
      if (glLocation < 0) {
        throw new Error(`can not find attribute named: ${this.name}`);
      }

      this.glLocation = glLocation;
    }
  }

  setBuffer(bufferAccessor: BufferAccessor): this {
    const gl = this.program.context.gl;
    gl.enableVertexAttribArray(this.glLocation);
    // Bind the position buffer.
    gl.bindBuffer(GL.ARRAY_BUFFER, bufferAccessor.buffer.glBuffer);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    gl.vertexAttribPointer(
      this.glLocation,
      bufferAccessor.componentsPerVertex,
      bufferAccessor.componentType,
      bufferAccessor.normalized,
      bufferAccessor.vertexStride,
      bufferAccessor.byteOffset,
    );
    return this;
  }
}

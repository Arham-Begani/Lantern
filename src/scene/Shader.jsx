import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * A ShaderMaterial built once, from the exact uniforms object the component
 * animates in useFrame. (Declaring <shaderMaterial uniforms={...}> left the
 * material holding a different uniforms object, so per-frame updates never
 * reached the GPU.)
 */
export function Shader({ uniforms, vertexShader, fragmentShader, ref: _ref, ...props }) {
  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
    Object.assign(m, props)
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniforms, vertexShader, fragmentShader])
  return <primitive object={material} attach="material" />
}

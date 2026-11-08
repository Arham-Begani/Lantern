import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'

/*
 * A moving dusk gradient (ShaderGradient, MIT) used while the 3D world is
 * still loading, and as the veil over a received lantern. It only runs
 * while it's visible and is unmounted afterwards, so it never competes
 * with the main scene for long.
 */
export default function Veil({ style }) {
  return (
    <ShaderGradientCanvas
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}
      pixelDensity={1}
      fov={45}
      lazyLoad={false}
      powerPreference="low-power"
    >
      <ShaderGradient
        control="props"
        type="waterPlane"
        animate="on"
        uSpeed={0.12}
        uStrength={1.6}
        uDensity={1.1}
        uFrequency={4.2}
        uAmplitude={1.5}
        uTime={0}
        color1="#0d1030"
        color2="#4a2c5e"
        color3="#ff9d4a"
        reflection={0.1}
        brightness={0.95}
        lightType="3d"
        grain="on"
        cAzimuthAngle={180}
        cPolarAngle={115}
        cDistance={3.4}
        cameraZoom={1}
        positionX={0}
        positionY={-1.4}
        positionZ={0}
        rotationX={0}
        rotationY={0}
        rotationZ={-40}
        envPreset="city"
      />
    </ShaderGradientCanvas>
  )
}

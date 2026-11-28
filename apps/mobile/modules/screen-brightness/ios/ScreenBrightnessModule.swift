import ExpoModulesCore
import UIKit

/// iOS keeps no per-app brightness, so the level before raising is held and put back on leaving, and on going to the background.
public class ScreenBrightnessModule: Module {
  private var before: CGFloat?

  public func definition() -> ModuleDefinition {
    Name("ScreenBrightness")

    AsyncFunction("raise") {
      if self.before == nil { self.before = UIScreen.main.brightness }
      UIScreen.main.brightness = 1
    }.runOnQueue(.main)

    AsyncFunction("restore") {
      self.putBack()
    }.runOnQueue(.main)

    OnAppEntersBackground {
      DispatchQueue.main.async { self.putBack() }
    }
  }

  private func putBack() {
    guard let level = before else { return }
    UIScreen.main.brightness = level
    before = nil
  }
}

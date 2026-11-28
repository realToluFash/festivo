import Contacts
import ContactsUI
import ExpoModulesCore

/// The system picker hands over only the people picked and needs no Contacts permission; a delegate with the many-contacts callback turns on multiple selection.
public class ContactPickerModule: Module {
  private var picking: Picking?

  public func definition() -> ModuleDefinition {
    Name("ContactPicker")

    AsyncFunction("pickMany") { (promise: Promise) in
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.resolve([])
        return
      }
      let picker = CNContactPickerViewController()
      let picking = Picking { contacts in
        self.picking = nil
        Self.once(presenter, isClearOf: picker) {
          promise.resolve(contacts.map(Self.kept))
        }
      }
      self.picking = picking
      picker.delegate = picking
      presenter.present(picker, animated: true)
    }.runOnQueue(.main)
  }

  /// The delegate hears Done while the picker is still going, and a window React Native puts up or takes down meanwhile is refused by UIKit (sc-7579).
  private static func once(
    _ presenter: UIViewController,
    isClearOf picker: UIViewController,
    waited: Int = 0,
    then: @escaping () -> Void
  ) {
    if presenter.presentedViewController !== picker || waited >= 40 {
      then()
      return
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
      once(presenter, isClearOf: picker, waited: waited + 1, then: then)
    }
  }

  /// iOS names its labels in lower case ("mobile", "home"); the row writes them as a word starting a line, keeping "iPhone" as it is.
  private static func firstUp(_ label: String) -> String {
    guard let first = label.first, first.isLowercase, label != "iPhone" else { return label }
    return first.uppercased() + label.dropFirst()
  }

  private static func kept(_ contact: CNContact) -> [String: Any] {
    let formatted = contact.areKeysAvailable([CNContactFormatter.descriptorForRequiredKeys(for: .fullName)])
      ? CNContactFormatter.string(from: contact, style: .fullName)
      : nil
    let name = formatted ?? [contact.namePrefix, contact.givenName, contact.middleName, contact.familyName]
      .filter { !$0.isEmpty }
      .joined(separator: " ")
    let numbers: [[String: Any]] = contact.phoneNumbers.map { labelled in
      let label = labelled.label ?? ""
      return [
        "number": labelled.value.stringValue,
        "label": label.isEmpty ? "" : Self.firstUp(CNLabeledValue<CNPhoneNumber>.localizedString(forLabel: label)),
        "mobile": label == CNLabelPhoneNumberMobile || label == CNLabelPhoneNumberiPhone,
      ]
    }
    let email = contact.emailAddresses.first.map { $0.value as String }

    return ["name": name, "numbers": numbers, "email": email as Any]
  }
}

private final class Picking: NSObject, CNContactPickerDelegate {
  private let done: ([CNContact]) -> Void

  init(done: @escaping ([CNContact]) -> Void) {
    self.done = done
  }

  func contactPicker(_ picker: CNContactPickerViewController, didSelect contacts: [CNContact]) {
    done(contacts)
  }

  func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
    done([])
  }
}

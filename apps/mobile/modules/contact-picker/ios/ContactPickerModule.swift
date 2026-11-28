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
        promise.resolve(contacts.map(Self.kept))
      }
      self.picking = picking
      picker.delegate = picking
      presenter.present(picker, animated: true)
    }.runOnQueue(.main)
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
        "label": label.isEmpty ? "" : CNLabeledValue<CNPhoneNumber>.localizedString(forLabel: label),
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
